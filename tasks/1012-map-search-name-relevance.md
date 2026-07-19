# TASK-20260718-1012: Релевантность поиска по названию места на карте

Status: Backlog
Owner: Manager (backend — Sergey/Codex)
Support: Developer, Tester, Reviewer
Created: 2026-07-18
Updated: 2026-07-18

## Goal

Сделать поиск по названию точки на карте (`GET /api/travels/search_travels_for_map/`,
параметр `where.query`) релевантным: запрос по слову должен находить объекты с этим словом,
а не любые подстрочные вхождения внутри других слов. Отдельно (не блокирующе) — показывать
точки под турпонятным именем, а не под официальным юр-названием из БД.

## Context

Источник: тикет борда **#1012** (`area=back`).

Поиск по названию — полностью серверный (BE #695, коммит `5735a07 "Filter map travel search
on backend"`, на проде живой). FE (`../metravel2`) только шлёт `where.query` и отображает выдачу.

### Симптом 1 — релевантность (корневая причина, прод = `origin/master`)

`../metravel-backend/travels/views_geo.py:283-304` — `TravelGeoViewMixin._apply_map_catalog_filters`.
Матчинг запроса реализован через `__icontains` (SQL `ILIKE '%query%'`), без границ слов, и сразу
по нескольким полям, включая поля **всего родительского travel**:

```python
# views_geo.py:294-302 (origin/master)
query = (filters.get('query') or '').strip()
if query:
    queryset = queryset.filter(
        Q(address__icontains=query)
        | Q(categories__name__icontains=query)
        | Q(travel__categories__name__icontains=query)
        | Q(travel__name__icontains=query)
        | Q(travel__slug__icontains=query)
    )
```

Два независимых источника шума:

1. **Подстрока внутри слова.** `ILIKE '%мир%'` совпадает с «Каз-**имир**-а», «Влад-**имир**»,
   «**Мир**он» и т.п. Границ слова нет.
2. **Матч по всему travel.** Условия `travel__name` / `travel__slug` / `travel__categories__name`
   срабатывают на уровне путешествия, поэтому при совпадении одной точки в выдачу попадают
   **все** точки того же маршрута (адреса, где слова вообще нет).

Валидатор поля: `../metravel-backend/travels/serializers.py:950`
(`SearchForMapWhereParamsSerializer.query = CharField(required=False, allow_blank=True, trim_whitespace=True)`).

Инфраструктура для нормального поиска **уже есть**: расширение `pg_trgm` установлено
(`../metravel-backend/travels/migrations/0018_facet_indexes.py:15` `TrigramExtension()`),
GIN-индексы `gin_trgm_ops` на `travels.name` и `travels.description`
(`../metravel-backend/travels/models.py:581-582`). Индекса на `travel_address.address` пока нет.

Прод-проба подтвердила репро (read-only, см. Validation): запрос `"Мир"` в радиусе Минска
возвращает `«Костёл Святого Казимира, ..., Логойск»`, а также точки `«8, улица Чкалова, Несвиж»`,
`«Несвижский сельский Совет»` — где слова «Мир» в адресе нет (совпало по родительскому travel).

### Симптом 2 — данные/контент (не блокирует симптом 1)

Отображаемое имя точки берётся из `TravelAddress.address`
(`../metravel-backend/travels/models.py:56`, `CharField(max_length=255)`); в ответе это поле
`address` + `title` (source=`travel.name`) сериалайзера `SearchForMapResponseSerializer`
(`../metravel-backend/travels/serializers.py:953+`). `address` заполняется из reverse-geocode
(OSM/провайдер) и содержит официальное юр-название («Республиканское научное дочернее унитарное
предприятие ИНСТИТУТ ЗАЩИТЫ РАСТЕНИЙ» вместо «Усадьба Прилуки»). Отдельного поля «турпонятное имя»
на модели `TravelAddress` нет.

Классификация: **content/data**, не блокирует фикс релевантности. Выносится отдельным шагом.

## Acceptance Criteria

Симптом 1 (релевантность — приоритет):
- [ ] Запрос-слово находит объекты, где это слово присутствует как слово (граница слова),
      а не как подстрока внутри другого слова.
- [ ] Запрос `"Мир"` НЕ возвращает «Костёл Святого Казимира» и подобные подстрочные ложные срабатывания.
- [ ] Запрос `"Мир"` возвращает «Мирский замок» и точки со словом «Мир».
- [ ] Совпадение по одной точке маршрута не тянет в выдачу все точки этого travel, где слова нет
      (матч по `travel__name`/`slug` пересмотреть: либо убрать, либо ранжировать ниже, либо
      применять к точкам, а не «раскрывать» весь travel).
- [ ] Форма ответа endpoint не меняется (ключи `data`/`results`, `total`/`count` — как сейчас;
      меняется только состав/порядок строк). Если добавляется ранжирование — порядок стабильный.
- [ ] Есть backend-тест в `tests/travels/test_map_catalog_api.py` на кейс «Мир» → есть Мирский,
      нет Казимира.

Симптом 2 (данные/контент — отдельно, не блокирует):
- [ ] Определён источник турпонятного имени: либо новое nullable-поле
      (напр. `TravelAddress.display_name`/`tourist_name`) с фолбэком на `address`, либо чистка данных.
- [ ] Если добавляется поле модели → **нужна миграция** (`makemigrations`), поле опциональное,
      обратная совместимость сохранена; в ответ добавляется дополнительный ключ (additive,
      не ломает FE).

## Gherkin Tests

```gherkin
Feature: Релевантный поиск по названию места на карте

  Scenario: Поиск по слову не ловит подстроку внутри другого слова
    Given на карте есть точки "Мирский замок" и "Костёл Святого Казимира"
    When пользователь ищет "Мир" через where.query
    Then в выдаче есть "Мирский замок"
    And в выдаче нет "Костёл Святого Казимира"

  Scenario: Совпадение точки не раскрывает весь маршрут
    Given маршрут содержит точку со словом "Мир" и точку "Несвижский сельский Совет"
    When пользователь ищет "Мир"
    Then "Несвижский сельский Совет" не попадает в выдачу только из-за родительского travel

  Scenario: Поиск по общему слову работает
    Given на карте есть замки
    When пользователь ищет "замок"
    Then в выдаче объекты, содержащие слово "замок"

  Scenario (content, non-blocking): Турпонятное имя точки
    Given у усадьбы Прилуки address содержит юр-название "ИНСТИТУТ ЗАЩИТЫ РАСТЕНИЙ"
    And задано display_name "Усадьба Прилуки"
    When точка отдаётся на карту
    Then отображается "Усадьба Прилуки"
```

## Task Contract

Scope: `travels/views_geo.py` (`_apply_map_catalog_filters`), опц. `travels/models.py` +
миграция (симптом 2), `tests/travels/test_map_catalog_api.py`. Настройки поиска — при необходимости
в `metravel/envs/common/settings.py`.

User-visible result: поиск на карте по названию возвращает релевантные объекты; шум-подстроки уходят.

Data/API contract: форма ответа не меняется (симптом 1). Симптом 2 — additive-ключ в ответе.
PostGIS-поля не трогать. Секреты не логировать.

Platform impact: desktop web, mobile web, Android — все потребляют один endpoint; фикс серверный,
проявится одинаково после деплоя бэка.

Localization impact: запросы кириллица (RU/BE/UK) и латиница (PL/EN). При переходе на FTS учесть
конфигурацию словаря (`simple` vs языковой): для смешанных гео-названий безопаснее `simple`-конфиг
или trigram, чтобы не терять словоформы/иностранные топонимы.

Dependencies: `pg_trgm` уже установлен (migration 0018). Новых пакетов не требуется; при добавлении —
только через `uv add`/`uv lock`.

Fallback/mock policy: FE fallback отсутствует и невозможен — релевантность целиком серверная.

Validation: см. раздел Validation (curl-пробы) + новый pytest.

Done gate: pytest зелёный; curl-пробы «Мир»/«замок» дают ожидаемую выдачу на деве, затем на проде
после деплоя.

## Likely Files Or Areas

- `../metravel-backend/travels/views_geo.py:283-304` — `_apply_map_catalog_filters` (ядро фикса).
- `../metravel-backend/travels/serializers.py:942-950` — `SearchForMapWhereParamsSerializer`.
- `../metravel-backend/travels/serializers.py:953+` — `SearchForMapResponseSerializer` (симптом 2).
- `../metravel-backend/travels/models.py:48-78` — `TravelAddress` (симптом 2, новое поле + миграция).
- `../metravel-backend/travels/models.py:581-582`, `migrations/0018_facet_indexes.py` — существующая
  trigram-инфраструктура (переиспользовать, при необходимости индекс на `travel_address.address`).
- `../metravel-backend/tests/travels/test_map_catalog_api.py` — тесты.

## Предлагаемый фикс (варианты, симптом 1)

**Вариант A — websearch FTS + ранжирование (рекомендуется для качества):**
`SearchVector` по `address` (+ `travel.name`, `categories.name` с меньшим весом) и
`websearch_to_tsquery` по запросу; `SearchRank` для сортировки. Конфиг словаря — `simple`
(гео-названия/иностранные топонимы не резать морфологией) либо продумать per-language.
Плюс: границы слов, ранжирование. Минус: нужен FTS-индекс/вычисление; словоформы на `simple`
не раскрываются (для точных названий это ок).

**Вариант B — trigram similarity с порогом (быстро, инфра уже есть):**
`pg_trgm` + `TrigramSimilarity('address', query) >= threshold` с сортировкой по similarity.
Плюс: минимальная миграция (индекс на `travel_address.address`), опечаткоустойчиво. Минус:
порог требует калибровки; короткие запросы («Мир») могут давать низкий similarity к длинным адресам
→ возможно комбинировать с word-boundary фильтром.

**Вариант C — минимальный (word-boundary regex):**
Заменить `__icontains` на границу слова: `address__iregex=r'(^|[^а-яёa-z])' + re.escape(q) + r'([^а-яёa-z]|$)'`
(экранировать ввод!). Плюс: точечно убирает симптом 1 без FTS/миграций. Минус: без ранжирования и
опечаткоустойчивости; regex по большой таблице без индекса медленнее (нужен замер).

Во всех вариантах: пересмотреть матч по `travel__name`/`travel__slug`/`travel__categories__name` —
он «раскрывает» весь маршрут. Либо убрать из основного фильтра, либо использовать только для
ранжирования (boost), либо оставить, но не расширять выдачу до всех точек travel.

Оценка влияния на текущую выдачу: выдача станет **уже** (меньше строк) — уйдут подстрочные ложные
срабатывания и «раскрытие всего travel». `total`/счётчик соответственно уменьшатся для затронутых
запросов. Пустые/односимвольные запросы поведение не меняют.

## Validation

Read-only прод-пробы (владелец может прогнать на dev до деплоя и на prod после):

```bash
# Симптом 1: "Мир" не должен ловить "Казимира" и не тянуть чужие точки
curl -s -G "https://metravel.by/api/travels/search_travels_for_map/" \
  --data-urlencode 'where={"lat":53.9,"lng":27.56,"radius":150,"query":"Мир"}' \
  --data-urlencode 'page=1' --data-urlencode 'perPage=200' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);r=d.get('data') or d.get('results') or d;print(len(r),'rows');[print(x['address'][:80]) for x in r]"
# Ожидаемо ПОСЛЕ фикса: есть 'Мирский Замок ...'; НЕТ 'Костёл Святого Казимира ...'

# "замок" — контрольный позитивный запрос
curl -s -G "https://metravel.by/api/travels/search_travels_for_map/" \
  --data-urlencode 'where={"lat":53.9,"lng":27.56,"radius":300,"query":"замок"}' \
  --data-urlencode 'page=1' --data-urlencode 'perPage=200' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);r=d.get('data') or d.get('results') or d;print(len(r),'rows')"
```

Backend-тест (добавить в `tests/travels/test_map_catalog_api.py`): создать travel с точками
«Мирский замок» и «Костёл Святого Казимира» в одном радиусе; запрос `query=Мир` → в выдаче
Мирский, нет Казимира; проверить, что точки без слова из того же travel не попадают.

## Влияние на фронтенд

Симптом 1: изменение — не breaking (форма ответа та же, меняется состав строк). FE-синхронизация
не требуется; **load-bearing FE-guard отсутствует** — релевантность целиком серверная, FE обойти
её не может (никакой временный FE-guard не держит эту проблему).

Симптом 2: если добавится доп. ключ (напр. `display_name`) — additive, FE подхватит опционально
(`../metravel2/api/*/Queries.ts` + типы точки карты) уже после деплоя бэка; не breaking.

## Progress Log

- 2026-07-18: Создан по итогам диагностики #1012. Корневая причина подтверждена в коде
  (`origin/master`) и прод-пробой (read-only GET).
