# Quests Backend Migration

## Архитектура

Квесты хранятся в Django-бэкенде и доступны через REST API:

| Эндпоинт | Метод | Описание |
|---|---|---|
| `/api/quests/` | GET, POST | Список / создание квестов |
| `/api/quests/{id}/` | GET, PATCH, DELETE | Квест по числовому ID |
| `/api/quests/by-quest-id/{quest_id}/` | GET | Квест по строковому ID (напр. `krakow-dragon`) |
| `/api/quests/cities/` | GET | Города с квестами |
| `/api/quest-progress/` | GET, POST | Прогресс пользователя |
| `/api/quest-progress/quest/{quest_id}/` | GET | Прогресс по квесту |

### Модели данных

**Quest (бандл):** `id`, `quest_id`, `title`, `steps` (JSON), `finale` (JSON), `intro` (JSON), `storage_key`, `city` (FK)

**QuestMeta (каталог):** `quest_id`, `title`, `points`, `city_id`, `lat`, `lng`, `duration_min`, `difficulty`, `tags`, `pet_friendly`, `cover_url`

**QuestProgress:** `quest`, `user`, `current_index`, `unlocked_index`, `answers`, `attempts`, `hints`, `show_map`, `completed`

### Фронтенд-адаптеры

Файл: `hooks/useQuestsApi.ts`

- `adaptStep()` — конвертирует шаг из API (парсит `lat`/`lng` из строк в числа)
- `adaptBundle()` — конвертирует бандл, принудительно ставит `id: 'intro'` для интро-шага
- `adaptMeta()` — конвертирует метаданные для каталога

---

## Миграция квестов на прод

### Предварительные требования

- Доступ к прод-серверу (SSH)
- Токен авторизации Django (`Token xxx`)
- Node.js 18+ (для скриптов миграции)
- Прод-бэкенд запущен и доступен

### Шаг 1: Миграция данных (текст, координаты, задания)

```bash
# Dry run — проверить JSON без отправки
node scripts/migrate-quests-to-backend.js --dry-run --api-url=https://api.metravel.by

# Отправить на прод
node scripts/migrate-quests-to-backend.js \
  --api-url=https://api.metravel.by \
  --token=YOUR_ADMIN_TOKEN
```

Скрипт создаёт 4 квеста:
| quest_id | Название | Шагов | Город |
|---|---|---|---|
| `krakow-dragon` | Тайна Краковского дракона | 7 | Kraków |
| `pakocim-voices` | Голоса Прокоцина | 10 | Kraków – Prokocim |
| `barkovshchina-spirits` | Хранитель тайн Барковщины | 6 | Барковщина |
| `minsk-cmok` | Тайна Свислочского Цмока | 7 | Минск |

### Шаг 2: Загрузка медиа-файлов

Медиа-файлы лежат в `assets/quests/`:

```
assets/quests/
├── krakowDragon/
│   ├── cover.png          # обложка квеста
│   ├── 1.png ... 7.png    # картинки шагов
│   └── krakowDragon.mp4   # видео финала
├── pakocim/
│   ├── cover.png
│   ├── 1.png
│   └── prokocim.mp4
├── barkovshchina/
│   ├── cover.png
│   ├── 1.png
│   └── forest.mp4
└── minskDragon/
    ├── cover.png
    ├── 1.png
    └── minskDragon.mp4
```

#### Вариант A: Через скрипт (если бэкенд поддерживает multipart upload)

```bash
# Dry run — показать файлы и размеры
node scripts/upload-quest-media.js --dry-run

# Загрузить
node scripts/upload-quest-media.js \
  --api-url=https://api.metravel.by \
  --token=YOUR_ADMIN_TOKEN
```

#### Вариант B: Через SCP + Django admin (рекомендуется)

```bash
# 1. Создать директории на сервере
ssh prod "mkdir -p /var/www/metravel/media/quests/{krakow-dragon,pakocim-voices,barkovshchina-spirits,minsk-cmok}"

# 2. Загрузить файлы
scp assets/quests/krakowDragon/* prod:/var/www/metravel/media/quests/krakow-dragon/
scp assets/quests/pakocim/* prod:/var/www/metravel/media/quests/pakocim-voices/
scp assets/quests/barkovshchina/* prod:/var/www/metravel/media/quests/barkovshchina-spirits/
scp assets/quests/minskDragon/* prod:/var/www/metravel/media/quests/minsk-cmok/

# 3. Установить права
ssh prod "chown -R www-data:www-data /var/www/metravel/media/quests/"
```

### Шаг 3: Обновить URL медиа в БД

После загрузки файлов на сервер, обновить URL в базе данных.

#### Через Django shell:

```bash
ssh prod
cd /var/www/metravel
python manage.py shell
```

```python
import json
from quests.models import Quest, QuestMeta

MEDIA_BASE = 'https://api.metravel.by/media/quests'

# Маппинг quest_id → директория и файлы
MEDIA_MAP = {
    'krakow-dragon': {
        'dir': 'krakow-dragon',
        'cover': 'cover.png',
        'video': 'krakowDragon.mp4',
        'step_images': {
            '1-rynek': '1.png', '2-mariacki': '2.png', '3-sukiennice': '3.png',
            '4-barbakan': '4.png', '5-kazimierz': '5.png', '6-wawel': '6.png',
            '7-smocza-jama': '7.png',
        },
    },
    'pakocim-voices': {
        'dir': 'pakocim-voices',
        'cover': 'cover.png',
        'video': 'prokocim.mp4',
        'step_images': {s: '1.png' for s in [
            '1-herb','2-palace','3-pond','4-oak','5-hedgehog',
            '6-birdhouses','7-slona-woda','8-fort','9-bridge','bonus-cafe',
        ]},
    },
    'barkovshchina-spirits': {
        'dir': 'barkovshchina-spirits',
        'cover': 'cover.png',
        'video': 'forest.mp4',
        'step_images': {s: '1.png' for s in [
            'point-1','point-1-2','point-2','point-2-2','point-3','point-3-2',
        ]},
    },
    'minsk-cmok': {
        'dir': 'minsk-cmok',
        'cover': 'cover.png',
        'video': 'minskDragon.mp4',
        'step_images': {s: '1.png' for s in [
            '1-forest-memory','2-sun-memory','3-star-memory','4-voice-memory',
            '5-memory-memory','6-word-memory','7-water-memory',
        ]},
    },
}

for quest_id, media in MEDIA_MAP.items():
    base = f"{MEDIA_BASE}/{media['dir']}"

    # Обновить cover_url в мета
    QuestMeta.objects.filter(quest_id=quest_id).update(
        cover_url=f"{base}/{media['cover']}"
    )

    # Обновить бандл
    quest = Quest.objects.get(quest_id=quest_id)

    # steps — обновить image_url
    steps = json.loads(quest.steps) if isinstance(quest.steps, str) else quest.steps
    for step in steps:
        img = media['step_images'].get(step['id'])
        if img:
            step['image_url'] = f"{base}/{img}"
    quest.steps = json.dumps(steps)

    # finale — обновить video_url
    finale = json.loads(quest.finale) if isinstance(quest.finale, str) else quest.finale
    if media.get('video'):
        finale['video_url'] = f"{base}/{media['video']}"
    quest.finale = json.dumps(finale) if isinstance(quest.finale, str) else finale

    quest.save()
    print(f"Updated {quest_id}")

print("Done!")
```

### Шаг 4: Проверка

```bash
# Проверить API
curl -s https://api.metravel.by/api/quests/ | python -m json.tool | head -20

# Проверить cover_url
curl -s https://api.metravel.by/api/quests/ | python -c "
import sys, json
for q in json.load(sys.stdin):
    print(f\"{q['quest_id']}: cover={q.get('cover_url', 'NULL')}\")
"

# Проверить медиа-файлы доступны
curl -sI https://api.metravel.by/media/quests/krakow-dragon/cover.png | head -5
curl -sI https://api.metravel.by/media/quests/krakow-dragon/1.png | head -5
```

### Шаг 5: Проверка на фронтенде

1. Открыть `/quests` — карточки квестов должны показывать обложки
2. Открыть `/quests/5/krakow-dragon` — карта должна отображаться с маркерами
3. Проверить, что картинки шагов загружаются (кнопка "Показать фото локации")
4. Проверить видео финала (пройти квест до конца или сбросить + перейти на "Финал")

---

## Известные особенности

### lat/lng приходят как строки
Бэкенд Django возвращает `DecimalField` как строки (`"50.0617000"`). Фронтенд-адаптер `adaptStep()` парсит их через `parseFloat()`.

### intro.id
Бэкенд хранит числовой `id` для интро-шага. Фронтенд-адаптер `adaptBundle()` принудительно ставит `id: 'intro'`, т.к. `QuestWizard` проверяет `step.id === 'intro'` для скрытия поля ввода.

### cover_url = null
Если обложка не загружена, фронтенд показывает fallback-карточку с названием и мета-данными вместо пустой карточки.

### Leaflet CSS
`QuestFullMap` вызывает `ensureLeafletCss()` перед рендером карты, чтобы CSS Leaflet был загружен.

---

## Скрипты

| Скрипт | Описание |
|---|---|
| `scripts/migrate-quests-to-backend.js` | Миграция текстовых данных квестов в БД |
| `scripts/upload-quest-media.js` | Загрузка медиа-файлов (cover, images, video) |

---

## Rollback

Если что-то пошло не так:

```bash
# Django shell
from quests.models import Quest, QuestMeta
Quest.objects.all().delete()
QuestMeta.objects.all().delete()
# Затем повторить миграцию с шага 1
```

> **Примечание:** Локальный реестр (`components/quests/registry.ts`, `cityQuests.ts`, `data/**`) удалён.
> Фронтенд полностью зависит от API. Если API недоступен, пользователь увидит сообщение об ошибке.
