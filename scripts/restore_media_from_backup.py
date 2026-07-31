#!/usr/bin/env python3
"""Восстановление медиа-объектов в S3 из локального бэкапа.

Обратная операция к `delete_media_orphans.py`. Читает манифест удаления
(`.backup/deletion-manifest.json`), берёт байты из локальной копии
(`.backup/s3/<ключ>`) и заливает их обратно под теми же ключами.

Когда это нужно
---------------
Если после удаления сирот где-то обнаружилась битая картинка. Манифест
содержит ВСЕ удалённые ключи с размерами и путями в бэкапе, поэтому вернуть
можно как всё разом, так и точечно — один ключ или один класс.

Порядок восстановления
----------------------
1. Убедиться, что нужные файлы есть локально:

       python3 scripts/restore_media_from_backup.py --check

2. Восстановить (нужны AWS-креды с правом записи в окружении):

       python3 scripts/restore_media_from_backup.py --apply --class responsive-images
       python3 scripts/restore_media_from_backup.py --apply --key "3099/conversions/x-thumb_200.jpg"
       python3 scripts/restore_media_from_backup.py --apply            # всё из манифеста

Если кредов локально нет
------------------------
Они есть в окружении контейнера приложения на проде. Тогда (реквизиты доступа —
`$PROD_USER@$PROD_HOST` и каталог деплоя — не хардкодим, репозиторий публичный):

       scp scripts/restore_media_from_backup.py "$PROD_USER@$PROD_HOST:$PROD_DIR/.tmp-restore.py"
       # скопировать нужные файлы бэкапа в $PROD_DIR/.tmp-restore-src/
       ssh "$PROD_USER@$PROD_HOST" 'docker exec metravel_app_1 python /app/.tmp-restore.py \
           --apply --source /app/.tmp-restore-src --manifest /app/.tmp-manifest.json'

Скрипт только ДОБАВЛЯЕТ объекты. Ничего не удаляет и не перезаписывает то,
что уже есть в бакете, если не передан `--overwrite`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = REPO_ROOT / '.backup' / 'deletion-manifest.json'
DEFAULT_SOURCE = REPO_ROOT / '.backup' / 's3'

CONTENT_TYPES = {
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.mp4': 'video/mp4',
    '.gpx': 'application/gpx+xml', '.xml': 'application/xml',
}


def content_type(key: str) -> str:
    ext = ('.' + key.rsplit('.', 1)[-1].lower()) if '.' in key else ''
    return CONTENT_TYPES.get(ext, 'application/octet-stream')


def load_entries(manifest_path: Path, source: Path, only_class, only_key):
    manifest = json.loads(manifest_path.read_text())
    entries = manifest['entries']
    if only_class:
        entries = [e for e in entries if e['class'] == only_class]
    if only_key:
        entries = [e for e in entries if e['key'] == only_key]
    # backup_path в манифесте абсолютный на момент генерации; source позволяет
    # восстановить с другого носителя или из контейнера.
    for e in entries:
        e['_local'] = source / e['key']
    return manifest, entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--manifest', default=str(DEFAULT_MANIFEST))
    parser.add_argument('--source', default=str(DEFAULT_SOURCE), help='каталог локальной копии')
    parser.add_argument('--class', dest='only_class', default=None, help='восстановить только один класс ключей')
    parser.add_argument('--key', default=None, help='восстановить один конкретный ключ')
    parser.add_argument('--check', action='store_true', help='только проверить наличие файлов локально')
    parser.add_argument('--apply', action='store_true', help='реально заливать в S3')
    parser.add_argument('--overwrite', action='store_true', help='перезаписывать объект, если он уже есть в бакете')
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        return fail(f'манифест не найден: {manifest_path}')

    manifest, entries = load_entries(manifest_path, Path(args.source), args.only_class, args.key)
    if not entries:
        return fail('под фильтр не попал ни один объект')

    bucket = manifest['bucket']
    print(f'манифест:  {manifest_path}  (создан {manifest["generated_at"]})')
    print(f'бакет:     s3://{bucket}')
    print(f'источник:  {args.source}')
    print(f'к восстановлению: {len(entries)} объектов, '
          f'{sum(e["size"] for e in entries) / 1024 / 1024:.0f} MiB\n')

    missing = [e for e in entries if not e['_local'].exists()]
    wrong = [e for e in entries
             if e['_local'].exists() and e['_local'].stat().st_size != e['size']]
    print(f'нет локально:        {len(missing)}')
    print(f'размер не совпал:    {len(wrong)}')
    for e in (missing + wrong)[:10]:
        print(f'   - {e["key"]}')

    if missing or wrong:
        print('\nВосстановить можно только то, что есть в бэкапе целиком.')
        if args.apply:
            return fail('отказ: часть файлов недоступна локально')

    if not args.apply:
        print('\nЭто проверка. Для восстановления добавь --apply (нужны AWS-креды с правом записи).')
        return 0

    try:
        import boto3  # noqa: PLC0415
    except ImportError:
        return fail('нужен boto3: python3 -m pip install --user boto3')
    if not (os.environ.get('AWS_ACCESS_KEY_ID') and os.environ.get('AWS_SECRET_ACCESS_KEY')):
        return fail('в окружении нет AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY')

    client = boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'eu-north-1'))
    restored = skipped = failed = 0

    for index, e in enumerate(entries, start=1):
        key = e['key']
        if not args.overwrite:
            try:
                client.head_object(Bucket=bucket, Key=key)
                skipped += 1
                continue
            except Exception:  # noqa: BLE001 — нет объекта, значит восстанавливаем
                pass
        try:
            client.upload_file(
                str(e['_local']), bucket, key,
                ExtraArgs={'ContentType': content_type(key)},
            )
            restored += 1
        except Exception as exc:  # noqa: BLE001
            print(f'  ✗ {key}: {exc}')
            failed += 1
        if index % 100 == 0 or index == len(entries):
            print(f'\r  {index}/{len(entries)}  восстановлено {restored}, '
                  f'пропущено {skipped}, ошибок {failed}', end='', flush=True)

    print(f'\n\nвосстановлено: {restored}   пропущено (уже были): {skipped}   ошибок: {failed}')
    return 1 if failed else 0


def fail(message: str) -> int:
    print(f'\n{message}', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
