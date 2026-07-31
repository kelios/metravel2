#!/usr/bin/env python3
"""Нормализация изображений квестов на проде через публичный API.

Зачем
-----
Изображения квестов лежат в S3 сырьём. Инвентаризация бакета 2026-07-30:

    quests/*/main/*.png    188 шт   438.7 MiB   средний 2390 KiB
    quests/*/step/*.png     76 шт    70.3 MiB   средний  947 KiB

Они попали туда мимо `ImageUploadMixin.set_image()` — без ресайза и без
конвертации в WebP. Замер: `quests/1/main/f137…png` = 2 438 301 B PNG 1536×1024,
тот же файл через прокси — 88 978 B WebP. Пока источник сырой, image-proxy
декодирует полноразмерный PNG на каждом промахе кэша; отсюда `capacity_rejected`
и p95 конверсии 1322 мс на холодном каталоге (#1137).

Скрипт скачивает изображение, ужимает локально и перезаливает через API. Путь
заливки проходит через `ProcessedImageWriteMixin` → `set_image()`, поэтому
бэкенд сам сохранит правильный WebP. Правок бэкенда не требуется.

    обложки        PATCH /api/quests/{id}/       поле cover_image
    шаги           PATCH /api/quest-steps/{id}/  поле image

Постеры финалов (141 JPEG, средний 229 KiB) НЕ трогаем: они уже приемлемого
размера, а выигрыш не оправдывает риск сломать экран финала. Видео финалов —
отдельная история и отдельный тикет (#1169): 144 mp4 по 4 МБ, и `video_url`
вообще отдаётся прямой ссылкой на S3 мимо прокси (#1131).

Важно про освобождение места
----------------------------
`_save_processed_images` заливает с `update=False`, то есть предыдущий файл
в S3 НЕ удаляется. Поэтому прогон добавит новые WebP, а старые PNG останутся
сиротами — их убирает чистка #1155 → #1157. Немедленный выигрыш здесь — CPU на
раздаче, а не объём хранилища.

Безопасность
------------
* По умолчанию — dry-run. Мутация только с `--apply`.
* Перед каждой заливкой оригинал сохраняется в `.backup/quest-images/` вместе
  с манифестом `manifest.json` (старый URL, ключ, размер, размеры в пикселях).
* После ПЕРВОЙ успешной заливки результат проверяется: новый URL должен
  оканчиваться на `.webp`. Если проверка не прошла — прогон останавливается,
  остальные объекты не трогаются.
* Токен читается ТОЛЬКО из переменной окружения `METRAVEL_API_TOKEN`, чтобы не
  оседать в истории шелла и в списке процессов.

Запуск
------
    python3 scripts/normalize_quest_covers_prod.py                       # отчёт
    python3 scripts/normalize_quest_covers_prod.py --targets steps       # только шаги
    METRAVEL_API_TOKEN=… python3 scripts/normalize_quest_covers_prod.py --apply --limit 1
    METRAVEL_API_TOKEN=… python3 scripts/normalize_quest_covers_prod.py --apply
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - зависимость окружения, не проекта
    sys.exit('Нужен Pillow: python3 -m pip install --user Pillow')


API_BASE = os.environ.get('METRAVEL_API_BASE', 'https://metravel.by')
S3_BASE = 'https://metravelprod.s3.eu-north-1.amazonaws.com'
PROXY_PREFIXES = ('/quest-cover/', '/quest-step-image/', '/quest-poster/')

# Верхняя граница берётся по самому крупному реальному применению — og:image при
# шеринге квеста (рекомендация Open Graph — 1200px). Карточки каталога (320/480)
# и hero берут свои размеры с лестницы image-proxy, хранить больше 1200 незачем.
TARGET_MAX_SIDE = 1200

# Порог «файл уже в порядке»: WebP, укладывается в TARGET_MAX_SIDE и не толще этого.
ACCEPTABLE_MAX_BYTES = 300 * 1024

BACKUP_DIR = Path(__file__).resolve().parent.parent / '.backup' / 'quest-images'
HTTP_TIMEOUT = 60
RETRIES = 3


def fetch_bytes(url: str, *, headers: dict | None = None) -> bytes:
    """GET с повтором — S3 и прод под нагрузкой закрывают соединения."""
    last_error: Exception | None = None
    for attempt in range(1, RETRIES + 1):
        try:
            request = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
                return response.read()
        except urllib.error.HTTPError:
            raise
        except Exception as exc:  # noqa: BLE001 — сеть: повторяем, а не падаем
            last_error = exc
            if attempt < RETRIES:
                time.sleep(2 ** attempt)
    raise last_error  # type: ignore[misc]


def auth_headers(token: str | None) -> dict:
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = f'Token {token}'
    return headers


def api_get_json(path: str, token: str | None) -> dict:
    return json.loads(fetch_bytes(f'{API_BASE}{path}', headers=auth_headers(token)))


def fetch_all_quests(token: str | None) -> list[dict]:
    quests: list[dict] = []
    page = 1
    while True:
        payload = api_get_json(f'/api/quests/?limit=100&page={page}', token)
        batch = payload.get('data') or []
        quests.extend(batch)
        if not payload.get('next_page_url') or not batch:
            break
        page += 1
    return quests


def storage_key_from_url(url: str) -> str | None:
    """`https://metravel.by/quest-cover/quests/1/main/x.png` → `quests/1/main/x.png`."""
    try:
        path = urllib.parse.urlparse(url).path
    except ValueError:
        return None
    for prefix in PROXY_PREFIXES:
        if path.startswith(prefix):
            return path[len(prefix):].lstrip('/')
    # Прямые ссылки на S3 (см. #1131) — ключ это весь путь.
    if 'metravelprod.s3' in url:
        return path.lstrip('/')
    return None


def collect_targets(token: str | None, kinds: set[str]) -> tuple[list[dict], int]:
    """Собрать объекты-кандидаты. Возвращает (targets, сколько без изображения)."""
    targets: list[dict] = []
    missing = 0
    quests = fetch_all_quests(token)
    print(f'Квестов получено: {len(quests)}')

    if 'covers' in kinds:
        for quest in quests:
            url = quest.get('cover_url')
            if not url:
                missing += 1
                continue
            targets.append({
                'kind': 'cover',
                'label': quest.get('quest_id') or f'quest-{quest.get("id")}',
                'url': url,
                'endpoint': f'/api/quests/{quest.get("id")}/',
                'field': 'cover_image',
                'refetch': f'/api/quests/{quest.get("id")}/',
                'url_field': 'cover_url',
            })

    if 'steps' in kinds:
        print('Читаю шаги квестов…')
        for index, quest in enumerate(quests, start=1):
            quest_id = quest.get('quest_id')
            if not quest_id:
                continue
            try:
                bundle = api_get_json(f'/api/quests/by-quest-id/{urllib.parse.quote(quest_id)}/', token)
            except Exception as exc:  # noqa: BLE001
                print(f'  ! {quest_id}: не удалось прочитать бандл — {exc}')
                continue
            for step in bundle.get('steps') or []:
                url = step.get('image_url')
                if not url:
                    continue
                targets.append({
                    'kind': 'step',
                    'label': f'{quest_id}/{step.get("step_id") or step.get("id")}',
                    'url': url,
                    'endpoint': f'/api/quest-steps/{step.get("id")}/',
                    'field': 'image',
                    'refetch': None,  # у шага нет одиночного GET — проверяем через бандл
                    'url_field': 'image_url',
                    'quest_id': quest_id,
                    'step_pk': step.get('id'),
                })
            if index % 25 == 0:
                print(f'  …{index}/{len(quests)}')

    return targets, missing


def download_source(url: str) -> tuple[bytes, str]:
    """Оригинал берём напрямую из S3 (максимальное качество).

    Если прямое чтение закрыто (его планируют закрыть — #1158), откатываемся на
    image-proxy: он отдаёт исходник целиком, перекодированный в WebP.
    """
    key = storage_key_from_url(url)
    if key:
        try:
            return fetch_bytes(f'{S3_BASE}/{urllib.parse.quote(key)}'), 's3'
        except urllib.error.HTTPError:
            pass
    return fetch_bytes(url, headers={'Accept': 'image/webp,image/*'}), 'proxy'


def describe(payload: bytes) -> tuple[str, int, int]:
    with Image.open(io.BytesIO(payload)) as image:
        return (image.format or '?'), image.width, image.height


def needs_normalization(image_format: str, width: int, height: int, size_bytes: int) -> str | None:
    if image_format.upper() != 'WEBP':
        return f'формат {image_format}, а не WEBP'
    if max(width, height) > TARGET_MAX_SIDE:
        return f'{width}×{height} больше {TARGET_MAX_SIDE}px'
    if size_bytes > ACCEPTABLE_MAX_BYTES:
        return f'{size_bytes // 1024} KiB больше порога {ACCEPTABLE_MAX_BYTES // 1024} KiB'
    return None


def build_normalized_png(payload: bytes) -> bytes:
    """Ужать до TARGET_MAX_SIDE и отдать PNG без потерь.

    Лоссовое сжатие делает сервер (WebP q85) — ровно один раз.
    """
    with Image.open(io.BytesIO(payload)) as image:
        ImageOps.exif_transpose(image, in_place=True)
        if max(image.width, image.height) > TARGET_MAX_SIDE:
            image.thumbnail((TARGET_MAX_SIDE, TARGET_MAX_SIDE), Image.Resampling.LANCZOS)
        prepared = image.convert('RGBA') if image.mode in ('RGBA', 'LA', 'P') else image.convert('RGB')
        buffer = io.BytesIO()
        prepared.save(buffer, format='PNG', optimize=True)
        if prepared is not image:
            prepared.close()
        return buffer.getvalue()


def patch_image(endpoint: str, field: str, filename: str, payload: bytes, token: str) -> None:
    boundary = f'----metravel{uuid.uuid4().hex}'
    head = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f'Content-Type: image/png\r\n\r\n'
    ).encode()
    body = head + payload + f'\r\n--{boundary}--\r\n'.encode()

    request = urllib.request.Request(
        f'{API_BASE}{endpoint}',
        data=body,
        method='PATCH',
        headers={
            'Authorization': f'Token {token}',
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'Accept': 'application/json',
        },
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
        response.read()


def current_url(target: dict, token: str | None) -> str:
    """Перечитать актуальный URL объекта после заливки."""
    if target['kind'] == 'cover':
        fresh = api_get_json(target['refetch'], token)
        return fresh.get('cover_url') or ''
    bundle = api_get_json(f'/api/quests/by-quest-id/{urllib.parse.quote(target["quest_id"])}/', token)
    for step in bundle.get('steps') or []:
        if step.get('id') == target['step_pk']:
            return step.get('image_url') or ''
    return ''


def stored_size(url: str) -> int | None:
    key = storage_key_from_url(url)
    if not key:
        return None
    try:
        return len(fetch_bytes(f'{S3_BASE}/{urllib.parse.quote(key)}'))
    except urllib.error.HTTPError:
        return None


def save_backup(storage_key: str, payload: bytes, record: dict) -> None:
    target = BACKUP_DIR / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)

    manifest_path = BACKUP_DIR / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    manifest.append(record)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--apply', action='store_true', help='реально заливать (без флага — только отчёт)')
    parser.add_argument('--limit', type=int, default=0, help='обработать не больше N объектов (0 = все)')
    parser.add_argument('--targets', choices=['covers', 'steps', 'all'], default='all')
    parser.add_argument('--quest-id', default=None, help='только один квест по его строковому quest_id')
    args = parser.parse_args()

    token = os.environ.get('METRAVEL_API_TOKEN')
    if args.apply and not token:
        return _fail('Для --apply нужен METRAVEL_API_TOKEN в переменных окружения.')

    kinds = {'covers', 'steps'} if args.targets == 'all' else {args.targets}
    print(f'Цель: максимальная сторона {TARGET_MAX_SIDE}px, порог веса {ACCEPTABLE_MAX_BYTES // 1024} KiB')
    print(f'Объекты: {", ".join(sorted(kinds))}')
    print(f'Режим: {"ЗАЛИВКА" if args.apply else "dry-run (ничего не меняется)"}\n')

    targets, missing = collect_targets(token, kinds)
    if args.quest_id:
        targets = [t for t in targets if t['label'].split('/')[0] == args.quest_id]
    print(f'\nОбъектов с изображением: {len(targets)}  |  без изображения: {missing}\n')

    candidates: list[tuple[dict, str, bytes, str, tuple[str, int, int]]] = []
    skipped = failed = 0

    for target in targets:
        try:
            payload, origin = download_source(target['url'])
            meta = describe(payload)
        except Exception as exc:  # noqa: BLE001 — отчётный скрипт, падать целиком не должен
            print(f'  ! {target["label"]}: не удалось прочитать — {exc}')
            failed += 1
            continue

        reason = needs_normalization(*meta, len(payload))
        if reason is None:
            skipped += 1
            continue

        key = storage_key_from_url(target['url'])
        if not key:
            print(f'  ! {target["label"]}: URL вне известных префиксов — пропуск ({target["url"]})')
            failed += 1
            continue

        candidates.append((target, key, payload, origin, meta))
        fmt, width, height = meta
        print(f'  → {target["kind"]:5} {target["label"]:34} {len(payload) // 1024:6} KiB  {fmt:5} {width}×{height}  ({reason})')

        if args.limit and len(candidates) >= args.limit:
            break

    total_before = sum(len(item[2]) for item in candidates)
    print(f'\nКандидатов: {len(candidates)}  |  уже в порядке: {skipped}  |  ошибок чтения: {failed}')
    print(f'Суммарный вес кандидатов сейчас: {total_before / 1024 / 1024:.1f} MiB')

    if not args.apply:
        print('\nЭто dry-run. Для заливки: METRAVEL_API_TOKEN=… python3 scripts/normalize_quest_covers_prod.py --apply')
        return 0
    if not candidates:
        print('\nНечего делать.')
        return 0

    print(f'\nБэкап оригиналов: {BACKUP_DIR}')
    print('Напоминание: заливка идёт с update=False на стороне бэкенда, поэтому старые')
    print('файлы останутся в S3 сиротами до чистки #1155 → #1157. Место освободится там.\n')

    total_after = 0
    verified = False

    for index, (target, key, payload, origin, meta) in enumerate(candidates, start=1):
        fmt, width, height = meta
        save_backup(key, payload, {
            'kind': target['kind'],
            'label': target['label'],
            'endpoint': target['endpoint'],
            'old_url': target['url'],
            'storage_key': key,
            'bytes': len(payload),
            'pixels': f'{width}×{height}',
            'format': fmt,
            'downloaded_from': origin,
        })

        try:
            normalized = build_normalized_png(payload)
            filename = f'{key.rsplit("/", 1)[-1].rsplit(".", 1)[0]}.png'
            patch_image(target['endpoint'], target['field'], filename, normalized, token)
        except Exception as exc:  # noqa: BLE001
            print(f'  ✗ [{index}/{len(candidates)}] {target["label"]}: заливка не удалась — {exc}')
            return _fail('Прогон остановлен на первой же ошибке заливки.')

        time.sleep(0.5)  # прод — 1 vCPU, не устраиваем себе же шторм конверсий
        new_url = current_url(target, token)
        new_size = stored_size(new_url)

        if not verified:
            if not new_url.lower().endswith('.webp'):
                print(f'  ✗ {target["label"]}: после заливки URL = {new_url} — бэкенд не сконвертировал в WebP.')
                return _fail(
                    'Путь заливки не проходит через set_image(). Остановлено после первого '
                    'объекта, остальные не тронуты. Это подтверждает #1152 — сначала нужна '
                    'правка бэкенда.'
                )
            verified = True
            print('  ✓ проверка после первой заливки пройдена: бэкенд отдаёт WebP\n')

        total_after += new_size or 0
        after = (new_size // 1024) if new_size else '?'
        print(f'  ✓ [{index}/{len(candidates)}] {target["label"]:34} {len(payload) // 1024:6} KiB → {after} KiB')

    print(f'\nБыло: {total_before / 1024 / 1024:.1f} MiB   стало: {total_after / 1024 / 1024:.1f} MiB')
    print(f'Оригиналы сохранены в {BACKUP_DIR} (manifest.json содержит старые URL).')
    print('Старые объекты в S3 станут сиротами — снять их чисткой #1155 → #1157.')
    return 0


def _fail(message: str) -> int:
    print(f'\n{message}', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
