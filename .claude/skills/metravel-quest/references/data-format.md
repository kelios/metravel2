# Формат data-файла, контракты бэка и API

## Файл

Образец — `scripts/golshany-quest-data.js` (формат и тон),
`module.exports = [ { quest } ]`. Поля квеста: `quest_id` (kebab-case),
`title`, `city: { name, lat, lng, country }`, `meta`, `storage_key`, `intro`,
`steps[]`, `finale`. Шаг: `step_id`, `title`, `location`, `story`, `task`,
`hint`, `answer_pattern: { type, value }`, `lat`, `lng`, `mapsUrl`, опц.
`point_role`, `poi_info`.

- Координаты — decimal degrees, 6 знаков; `mapsUrl` —
  `https://maps.google.com/?q=<lat>,<lng>` (или `?q=<место>`).
- `meta`: `duration_min`, `difficulty` (`easy`/`medium`/`hard`), `tags`
  (таксономия ниже), опц. `pet_friendly`.
- `country` — id страны КВЕСТА (не travel-страна): Польша 160, Беларусь 3,
  Армения 6; полный список `GET /api/countries/`.
- `intro` — `is_intro`, `answer_pattern.type='any'`: завязка, тон, правила
  прохождения, направление к первой точке. `finale.text` — тёплый вывод о
  городе и маршруте; видео и постер финала — скилл `metravel-quest-finale`.
- **Новая страна каталога:** заголовок группы берётся из `COUNTRY_NAME_KEYS`
  (`screens/tabs/QuestsScreen.helpers.ts`): ключ — ISO alpha-2 из
  `country_code` ответа `/quests/`, значение — ключ i18n
  `quests:screens.tabs.QuestsScreen.country.<CODE>`, перевод во всех локалях
  RU/BE/UK/PL/EN, иначе в каталоге сырой код. Страж —
  `__tests__/screens/QuestsScreen.helpers.test.ts`.

## quest_id и город

- Один сюжет — один `quest_id`; правка существующего квеста идёт под тем же
  `quest_id`, `step_id` и `storage_key` (по ним ключуется прогресс игроков).
- Второй квест существующего города переиспользует его city id:
  `POST /api/quest-cities/` по имени не дедупит, universal-миграция дедупит.
- Alias посадочной `/quests/<alias>` фронт и бэк считают одной эвристикой по
  `quest_id` (`utils/questCityAlias.js` ↔ бэк `quests/services/city_alias.py`).
  Многословный город: латиница пишет КАЖДОЕ слово имени без сокращений
  (`veliky-novgorod-sadko`, `sankt-gallen-…`, не `veliky-…`, `st-gallen-…`), длина
  латиницы 0,9–1,5 от букв русского имени, после города — хотя бы один токен
  темы; имя со скобками («Чёртов мост (Андерматт)») — ориентир, `quest_id` по
  городу. Название праздника в `quest_id` и `title` не пишется. `quest:gates`
  сверяет прогноз alias с продом и sitemap (#2209).

## answer_pattern

`value` составных типов — строка `JSON.stringify(...)`.

- `any` — `{ type: 'any', value: '' }`: интро и «дойди / нажми Далее».
- `exact` — одно число/слово без вариантов.
- `exact_any` — `JSON.stringify([...])`, варианты lowercase, без пунктуации,
  ё→е, каждый вариант в ОДНОМ алфавите. Падежные формы RU/BE пишет не автор:
  `utils/questAnswerMorphology.ts` (второй проход `buildAnswerChecker`)
  принимает их сам для слов ≥4 букв. Автор выписывает синонимы, рус/бел/местные
  названия, латиницу имён, порядок слов в составных («меч и щит», «щит и меч»),
  формы с чередованием основы (орёл/орла, осколок/осколки), слова короче 4 букв
  и написания через пробел и дефис (нормализатор дефис убирает, пробел — нет:
  «темно-синий» → `темносиний`, а «темно синий» — отдельная форма). Числа и
  числительные сравниваются строго.
- `range` — `JSON.stringify({ min, max })`: счёт по 4/4g.
- `any_text` — `JSON.stringify({ min_length })`, `min_length` 4–10, но не выше
  самого короткого варианта, который шаг сам перечисляет (скан
  `scan-quest-anytext-minlen`). Задание звучит как приглашение: «Опиши…»,
  «Ответ свободный»; UI подписывает поле и на короткий текст говорит «Слишком
  коротко».
- `any_number` — любое число; `approx` — `{ target, tolerance }`.
- `input_type`: `number` для range / числового exact / any_number, иначе `text`.
- Нормализация ввода (`normalize` в `utils/questAdapters.ts`): lowercase,
  схлоп пробелов, удаление пунктуации, ё→е; та же нормализация применяется к
  словарю.
- Прод отдаёт `answer_pattern` ОБЪЕКТОМ — конвертер прод→файл обязан это учесть.

## point_role (бэк-контракт с 09.2026)

Бэк отклоняет нумерованный шаг активного квеста без роли. Интро — `start`;
шаги — `required` | `optional` | `final`. Миграция ставит сама: явное поле
приоритетно, иначе `type === 'any'` → `optional`, последний → `final`,
остальные → `required`. Привал с проверяемым ответом («по желанию»,
`any_text`) — `point_role: 'optional'` явно, и пометка «по желанию» в
заголовке (скан `scan-quest-point-roles`). `sync-quest-to-prod.js` патчит роль
только явно заданную. Фронт: `pointRole` в `utils/questAdapters.ts`.

## poi_info

На каждой точке-музее или платном объекте (даже обязательной) и на каждой
опциональной точке с расписанием. Схема строгая, лишний ключ → 400:

```js
poi_info: {
  is_museum: true,                          // обязательное boolean
  opening_hours: 'вт–вс 10:00–18:00',       // опц., строка ≤500
  ticket_price: '15 BYN, детям до 7 бесплатно', // опц., строка ≤500
  website: 'https://example.by/',           // опц., http(s) ≤500
}
```

Кафе и смотровая — `is_museum: false`; обычный шаг — без `poi_info`. Часы и
цена — с официального сайта на дату написания, по-русски, с детским тарифом и
разбивкой на перерывы; нестабильное — осторожно или только `website`. Старые
квесты: часы в story оставить, продублировать структурно. Пишут миграция и
`sync-quest-to-prod.js`; фронт рисует блок в `questWizardStepCard`.

## Теги meta.tags

Канонический словарь, новые без нужды не выдумывать:

- аудитория: `kids`, `teens`, `family`, `age-5-7`, `age-8-10`, `age-11-14`,
  `adult-required`, `adult-recommended` (`pet_friendly` — поле meta);
- прогулка: `public-walk`, `public-park-walk`, `public-art-walk`;
- жанр: `legend`, `myth`, `mystic`, `detective`, `fairytale`, `story`,
  `history`, `memorial`, `memory`;
- подборки каталога (реестр `utils/questThemes.ts`): «Легенды и призраки» —
  `mystic`/`myth`/`mystery`/`ghost` (`legend` в подборку не ведёт, он у 60%
  каталога); «Детектив» — `detective`; «Сказки» — `fairytale`; «Хэллоуин»
  (15.10–1.11) — `halloween`; «Рождество и Новый год» (1.12–14.01) —
  `christmas`. Сезонный тег — ВМЕСТЕ с вечным жанровым
  (`['christmas', 'legend', …]`), чтобы вне сезона квест жил в вечной подборке;
- слой: `citywalk`, `park`, `roadtrip`, `street-art`, `art`, `sculpture`,
  `architecture`, `culture`, `urbanism`, `urban-symbols`, `visual-literacy`,
  `music`, `animals`, `logic`, `puzzle`;
- место: `castle`, `palace`, `tower`, `monastery`, `pilgrimage`, `unesco`,
  `lake`, `river`, `sea`, `forest`, `mountain`, `nature`, `spring`, `hiking`,
  `railway`, `food`, `wine`, `religion`.

Bundle `by-quest-id` meta/tags не отдаёт — они в списке; тег на проде меняется
`PATCH /api/quests/<id>/`.

## API

- `GET /api/quests/` — список, ПАГИНИРОВАН (`results` + `next`), с `city_alias`.
- `GET /api/quests/by-quest-id/<quest_id>/` — intro + steps (+ `poi_info`) +
  finale.
- Запись (Token, admin): `/api/quest-cities/` (не дедупит), `/api/quests/`,
  `/api/quest-steps/` (`poi_info` объектом, `geo_verify`), `/api/quest-finales/`
  (finale id не обязан равняться id квеста — сверять по тексту финала).
- Фронт-роут детали `/quests/{cityId}/{quest_id}`; проверка ответа —
  `buildAnswerChecker` (`utils/questAdapters.ts`), оценка —
  `utils/questAnswerEvaluation.ts`; `poi_info` → `adaptPoiInfo` в
  `components/quests/questWizardStepCard.tsx`.
