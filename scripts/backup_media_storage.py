#!/usr/bin/env python3
"""Полный бэкап медиа-хранилища S3 на локальный диск.

Это первый шаг любых операций с картинками: пока полной локальной копии нет,
ни перегон источников, ни удаление legacy-мусора запускать нельзя.

Состояние бакета на 2026-07-30: 57 163 объекта / 11.16 ГиБ.

Креды
-----
НУЖНЫ для перечисления. 2026-07-30 по #1158 анонимный листинг бакета закрыт
(снят грант `List` у `AllUsers` в ACL) — `?list-type=2` теперь отдаёт 403.
Поставь `pip install boto3` и заполни AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
(шаблон — `.env.media-ops.example`), скрипт сам переключится на подписанные
запросы. Ключ нужен только на чтение: `s3:ListBucket` + `s3:GetObject`.

Сами объекты пока остаются публичными на чтение, поэтому докачка без ключей
работает — но только если локальная опись `inventory.json` уже есть.

Свойства
--------
* Возобновляемый: уже скачанный объект с совпадающим размером пропускается,
  поэтому прерванный прогон можно просто перезапустить.
* Проверяемый: пишет `inventory.json` со всеми ключами, размерами и ETag,
  плюс `SUMMARY.txt`. `--verify` сверяет локальную копию с бакетом без скачивания.
* Ничего не мутирует в S3 — только чтение.

Запуск
------
    python3 scripts/backup_media_storage.py --dry-run   # только посчитать объём
    python3 scripts/backup_media_storage.py             # качать
    python3 scripts/backup_media_storage.py --verify    # сверить локальную копию
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ElementTree
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

S3_NS = '{http://s3.amazonaws.com/doc/2006-03-01/}'
DEFAULT_BUCKET = os.environ.get('MEDIA_S3_BUCKET', 'metravelprod')
DEFAULT_REGION = os.environ.get('AWS_REGION', 'eu-north-1')
REPO_ROOT = Path(__file__).resolve().parent.parent
HTTP_TIMEOUT = 120
RETRIES = 3

# Качаем напрямую из S3, а не через наш прод-хост, поэтому параллелизм не
# нагружает сайт. 8 потоков сокращают прогон по 57k объектов с нескольких часов
# до примерно четверти часа; выше — упираемся в диск и смысла не добавляет.
DOWNLOAD_WORKERS = int(os.environ.get('MEDIA_BACKUP_WORKERS', '8'))


def bucket_endpoint(bucket: str, region: str) -> str:
    return f'https://{bucket}.s3.{region}.amazonaws.com'


def fetch_bytes(url: str) -> bytes:
    """GET с повтором.

    S3 под нагрузкой закрывает соединения (`Connection reset by peer`), и это
    штатное поведение, а не отказ. Первый прогон бэкапа упал именно так — на
    перечислении, где повтора не было.
    """
    last_error: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as response:
                return response.read()
        except urllib.error.HTTPError:
            raise
        except Exception as exc:  # noqa: BLE001 — сеть: повторяем, а не падаем
            last_error = exc
            if attempt < RETRIES:
                time.sleep(2 ** attempt)
    raise last_error  # type: ignore[misc]


class ListingClosed(RuntimeError):
    """Анонимное перечисление закрыто (#1158) — нужны подписанные запросы."""


def have_credentials() -> bool:
    return bool(os.environ.get('AWS_ACCESS_KEY_ID') and os.environ.get('AWS_SECRET_ACCESS_KEY'))


def load_boto_client(region: str):
    try:
        import boto3  # noqa: PLC0415 — опциональная зависимость
    except ImportError:
        sys.exit(
            'В окружении есть AWS-ключи, но нет boto3.\n'
            'Поставь его: python3 -m pip install --user boto3'
        )
    return boto3.client('s3', region_name=region)


def list_objects_anonymous(bucket: str, region: str) -> list[dict]:
    endpoint = bucket_endpoint(bucket, region)
    objects: list[dict] = []
    token: str | None = None

    while True:
        url = f'{endpoint}/?list-type=2&max-keys=1000'
        if token:
            url += f'&continuation-token={urllib.parse.quote(token)}'
        try:
            payload = fetch_bytes(url)
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                raise ListingClosed from exc
            raise
        root = ElementTree.fromstring(payload)

        for entry in root.findall(f'{S3_NS}Contents'):
            objects.append({
                'key': entry.find(f'{S3_NS}Key').text,
                'size': int(entry.find(f'{S3_NS}Size').text),
                'etag': (entry.find(f'{S3_NS}ETag').text or '').strip('"'),
            })

        truncated = root.find(f'{S3_NS}IsTruncated')
        next_token = root.find(f'{S3_NS}NextContinuationToken')
        if truncated is not None and truncated.text == 'true' and next_token is not None:
            token = next_token.text
            print(f'\r  перечислено объектов: {len(objects)}', end='', flush=True)
        else:
            break

    print(f'\r  перечислено объектов: {len(objects)}')
    return objects


def list_objects_signed(client, bucket: str) -> list[dict]:
    objects: list[dict] = []
    for page in client.get_paginator('list_objects_v2').paginate(Bucket=bucket):
        for entry in page.get('Contents', []):
            objects.append({
                'key': entry['Key'],
                'size': entry['Size'],
                'etag': (entry.get('ETag') or '').strip('"'),
            })
        print(f'\r  перечислено объектов: {len(objects)}', end='', flush=True)
    print(f'\r  перечислено объектов: {len(objects)}')
    return objects


def download_anonymous(bucket: str, region: str, key: str, target: Path) -> None:
    url = f'{bucket_endpoint(bucket, region)}/{urllib.parse.quote(key)}'
    target.write_bytes(fetch_bytes(url))


def download_signed(client, bucket: str, key: str, target: Path) -> None:
    client.download_file(bucket, key, str(target))


def human(num_bytes: float) -> str:
    return f'{num_bytes / 1024 / 1024 / 1024:.2f} GiB'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--dry-run', action='store_true', help='только перечислить и посчитать объём')
    parser.add_argument('--verify', action='store_true', help='сверить локальную копию с бакетом, не скачивая')
    parser.add_argument('--prefix', default=None, help='ограничить бэкап префиксом ключа')
    args = parser.parse_args()

    bucket = DEFAULT_BUCKET
    region = DEFAULT_REGION
    backup_dir = Path(os.environ.get('MEDIA_BACKUP_DIR') or (REPO_ROOT / '.backup' / 's3'))
    signed = have_credentials()
    client = load_boto_client(region) if signed else None

    inventory_path = backup_dir / 'inventory.json'

    print(f'Бакет:  s3://{bucket} ({region})')
    print(f'Доступ: {"подписанные запросы (boto3)" if signed else "анонимный HTTPS (объекты публичны, листинг закрыт #1158)"}')
    print(f'Куда:   {backup_dir}\n')

    print('Перечисление объектов…')
    try:
        objects = list_objects_signed(client, bucket) if signed else list_objects_anonymous(bucket, region)
    except ListingClosed:
        # Ожидаемо с 2026-07-30: #1158 закрыл анонимный листинг. Объекты читаются
        # по-прежнему, поэтому докачка и сверка работают по сохранённой описи.
        if not inventory_path.exists():
            sys.exit(
                'Анонимное перечисление бакета закрыто (#1158), локальной описи тоже нет.\n'
                'Нужен read-only IAM-ключ (s3:ListBucket + s3:GetObject на этот бакет):\n'
                '  python3 -m pip install --user boto3\n'
                '  cp .env.media-ops.example .env.media-ops   # заполни ключи\n'
                '  set -a && source .env.media-ops && set +a'
            )
        objects = json.loads(inventory_path.read_text())
        print(f'  листинг закрыт (#1158) → взял локальную опись: {len(objects)} ключей')
        print('  ВНИМАНИЕ: опись могла устареть — новых объектов в ней нет.')
        print('  Для точного перечисления заполни ключи в .env.media-ops.')
    if args.prefix:
        objects = [item for item in objects if item['key'].startswith(args.prefix)]
        print(f'  после фильтра по префиксу «{args.prefix}»: {len(objects)}')

    total = sum(item['size'] for item in objects)
    print(f'\nВсего: {len(objects)} объектов, {human(total)}')

    backup_dir.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        inventory_path.write_text(json.dumps(objects, ensure_ascii=False))
        print(f'Опись сохранена: {inventory_path}')
        print('Это dry-run, файлы не качались.')
        return 0

    if args.verify:
        missing = [item for item in objects if not (backup_dir / item['key']).exists()]
        wrong = [
            item for item in objects
            if (backup_dir / item['key']).exists()
            and (backup_dir / item['key']).stat().st_size != item['size']
        ]
        print(f'\nОтсутствует локально: {len(missing)}')
        print(f'Не совпал размер:     {len(wrong)}')
        for item in (missing + wrong)[:10]:
            print(f'  - {item["key"]}')
        if missing or wrong:
            print('\nБэкап НЕПОЛНЫЙ. Перезапусти скрипт без --verify, он докачает недостающее.')
            return 1
        print('\nБэкап полный: все объекты на месте и совпадают по размеру.')
        return 0

    stats = {'downloaded': 0, 'skipped': 0, 'failed': 0, 'bytes': 0, 'seen': 0}
    stats_lock = threading.Lock()
    total_count = len(objects)

    def handle(item: dict) -> None:
        key, size = item['key'], item['size']
        target = backup_dir / key

        if target.exists() and target.stat().st_size == size:
            outcome, gained = 'skipped', 0
        else:
            outcome, gained = 'failed', 0
            target.parent.mkdir(parents=True, exist_ok=True)
            for attempt in range(1, RETRIES + 1):
                try:
                    if signed:
                        download_signed(client, bucket, key, target)
                    else:
                        download_anonymous(bucket, region, key, target)
                    outcome, gained = 'downloaded', size
                    break
                except Exception as exc:  # noqa: BLE001 — качаем 57k объектов, один сбой не должен ронять прогон
                    if attempt == RETRIES:
                        print(f'\n  ✗ {key}: {exc}')

        with stats_lock:
            stats[outcome] += 1
            stats['bytes'] += gained
            stats['seen'] += 1
            seen = stats['seen']
            if seen % 100 == 0 or seen == total_count:
                print(
                    f'\r  {seen}/{total_count} ({seen * 100 // total_count}%)  '
                    f'скачано {stats["downloaded"]}, пропущено {stats["skipped"]}, '
                    f'ошибок {stats["failed"]}, {human(stats["bytes"])}',
                    end='',
                    flush=True,
                )

    print(f'Скачивание в {DOWNLOAD_WORKERS} потоков…')
    with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as pool:
        list(pool.map(handle, objects))

    downloaded, skipped, failed = stats['downloaded'], stats['skipped'], stats['failed']
    print()
    inventory_path.write_text(json.dumps(objects, ensure_ascii=False))

    summary = (
        f'Бэкап s3://{bucket}\n'
        f'объектов в бакете: {len(objects)}\n'
        f'объём:             {human(total)}\n'
        f'скачано:           {downloaded}\n'
        f'пропущено (были):  {skipped}\n'
        f'ошибок:            {failed}\n'
        f'каталог:           {backup_dir}\n'
    )
    (backup_dir / 'SUMMARY.txt').write_text(summary)
    print('\n' + summary)

    if failed:
        print('Есть ошибки — перезапусти скрипт, он докачает только недостающее.')
        return 1

    print(f'Опись: {inventory_path}')
    print('Проверить целостность: python3 scripts/backup_media_storage.py --verify')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
