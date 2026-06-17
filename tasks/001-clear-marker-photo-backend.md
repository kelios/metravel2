# TASK-20260617-001: Нельзя очистить фото у точки маршрута через save-эндпоинт

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-17
Updated: 2026-06-17

## Goal

Починить бэкенд-обработку поля `image` у точки маршрута (CoordsMeTravel) так, чтобы
`POST /api/travels/save` с `image: null` или `image: ""` корректно очищал фото точки
в БД, не возвращая 400 и не игнорируя входящее значение.

## Context

В редакторе путешествия (wizard, EditMarkerModal) пользователь может убрать фото точки
маршрута в UI, но после сохранения и перезагрузки фото возвращается обратно. Это баг
бэкенда — фронтенд корректно передаёт очищенное значение, сервер его игнорирует или
отклоняет.

**Цепочка сохранения:**
`POST /api/travels/save` → `TravelUpsertSerializer` → `_CoordsMeTravel(many=True)` →
`UpsertTravelService._process_travel_coordinates()` (репо `../metravel-backend`).

**Корневые причины (все на бэкенде):**

1. `travels/serializers.py:314` — `image = serializers.CharField(allow_null=True)`:
   нет `allow_blank=True` → `image: ""` отклоняется с 400; поле не помечено
   `required=False` → отсутствие ключа тоже даёт 400.
2. `travels/services/upsert_travel_service.py:194-221` — в блоках update и create сервис
   не присваивает `coord['image']` в `ta.image`; `image: null` проходит сериализатор,
   но поле в БД не обновляется → старое фото остаётся.
3. `travels/models.py:51` — `image = models.ImageField(...)` без `blank=True, null=True`
   (NOT NULL на уровне БД блокирует запись null).

**Текущее поведение:**
- `image: null` → сериализатор принимает, но сервис не записывает в БД → фото остаётся.
- `image: ""` → 400 Bad Request.
- без ключа `image` → 400 Bad Request.
Очистить фото точки невозможно никаким значением.

**FE-guard (нагруженный, не трогать без верификации бэк-фикса):**
`utils/travelFormNormalization.ts:296-304` — `normalizeMarkersForSave` подставляет
fallback-картинку, когда `image` пустой. Это workaround под текущий сериализатор
(который отклоняет пустые значения). Guard снимается/смягчается на FE **только после**:
верификации фикса на `origin/master` бэкенда + наблюдаемого поведения на проде +
покрытия FE-regression-тестом нового поведения.

**Примечание о трекере:** канонический источник правды — общий MCP task board (area=back).
Этот файл создан как локальная фиксация, т.к. на момент создания борд недоступен (нет
токена). После восстановления доступа задачу необходимо импортировать на борд через
агент `ticket-board` с `area=back`, затем локальный файл удалить.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `POST /api/travels/save` с `image: null` для существующей точки маршрута возвращает
  2xx и очищает поле `image` в БД (после рефетча поле пустое/null).
- [ ] `POST /api/travels/save` с `image: ""` для точки маршрута возвращает 2xx (не 400)
  и очищает поле `image` в БД.
- [ ] `POST /api/travels/save` без ключа `image` в объекте точки (новая точка без фото)
  возвращает 2xx — регресс создания точек без фото не сломан.
- [ ] `POST /api/travels/save` с корректным URL в `image` по-прежнему сохраняет фото —
  штатный сценарий не сломан.
- [ ] Модель `CoordsMeTravel.image` допускает `null` и `blank` значения (миграция
  применена).

## Gherkin Tests

```gherkin
Feature: Очистка фото у точки маршрута через save-эндпоинт

  Scenario: Удаление фото у существующей точки маршрута
    Given существующая точка маршрута с загруженным фото
    When клиент отправляет POST /api/travels/save с image: null (или image: "") для этой точки
    Then ответ имеет статус 2xx
    And после GET путешествия поле image у точки пустое или null

  Scenario: Создание новой точки маршрута без фото
    Given маршрут с новой точкой, в которой отсутствует ключ image
    When клиент отправляет POST /api/travels/save
    Then ответ имеет статус 2xx
    And точка создана в БД с пустым image

  Scenario: Сохранение точки с фото не нарушено
    Given точка маршрута с валидным URL в поле image
    When клиент отправляет POST /api/travels/save
    Then ответ имеет статус 2xx
    And после GET поле image точки содержит сохранённый URL
```

## Assignment

Primary owner: Backend (Sergey/Codex, репо `../metravel-backend`)
Support agents: Frontend Developer (снятие FE-guard после верификации), Tester (`test-author` — FE-regression-тест), `backend-status-sync` (верификация закрытия на борде)

## Likely Files Or Areas

- `travels/models.py:51` — поле `CoordsMeTravel.image` (добавить `blank=True, null=True`)
- `travels/serializers.py:314` — `_CoordsSerializer.image` (добавить `allow_blank=True, required=False`)
- `travels/services/upsert_travel_service.py:194-221` — блоки update и create в `_process_travel_coordinates` (присвоить `ta.image = coord.get('image') or ''`)
- `travels/migrations/` — новая миграция под изменение модели
- FE-файл (после верификации бэк-фикса): `utils/travelFormNormalization.ts:296-304`

## Plan

1. Модель: добавить `blank=True, null=True` к `CoordsMeTravel.image`, сгенерировать и
   применить миграцию.
2. Сериализатор (`serializers.py:314`): изменить объявление поля на
   `image = serializers.CharField(allow_null=True, allow_blank=True, required=False)`.
3. Сервис update-блок (~194-204): добавить `ta.image = coord.get('image') or ''`
   перед `ta.save()`.
4. Сервис create-блок (~209-216): аналогично — присвоить `image` при создании объекта.
5. Покрыть бэкенд-тестами: сценарии null / "" / без ключа / с URL.
6. Задеплоить на прод, верифицировать наблюдаемое поведение.
7. После верификации — уведомить FE-команду для снятия guard в
   `utils/travelFormNormalization.ts:296-304` и написания FE-regression-теста.

## Validation

```bash
# Проверить, что image: null принимается и очищается
curl -X POST https://metravel.by/api/travels/save \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"id": <travel_id>, "coords": [{"id": <coord_id>, "image": null, ...}]}'
# Ожидание: 2xx

# Проверить, что image: "" принимается и очищается
curl -X POST https://metravel.by/api/travels/save \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"id": <travel_id>, "coords": [{"id": <coord_id>, "image": "", ...}]}'
# Ожидание: 2xx (не 400)

# Рефетч и проверка поля
curl https://metravel.by/api/travels/<travel_id>/ \
  -H "Authorization: Token <token>"
# Ожидание: coords[].image == null или ""
```

Браузерная проверка: открыть EditMarkerModal точки с фото → удалить фото → сохранить путешествие → перезагрузить страницу → фото у точки отсутствует.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-17: Created.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
