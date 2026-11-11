# Смысловой подбор (AI picks) — #2459

## TL;DR

Блоки «Похожие статьи» на странице статьи и квеста и строка «Подобрать по описанию» на
`/search`, которые читают службу `metravel-assist` (#2456): `GET /ai/similar`, `POST /ai/search`.
Фича под флагом (web и native); при недоступности службы страницы выглядят как без неё. Макет и
состояния — `docs/design/AI_ASSIST_BLOCKS.md`.

## Фича-флаг и адрес службы

| переменная | dev | prod |
| --- | --- | --- |
| `EXPO_PUBLIC_AI_PICKS` | `1` | выставляется вместе с выкатом службы (#2457) |
| `EXPO_PUBLIC_AI_PICKS_URL` | пусто (same-origin, Metro проксирует `/ai/` → `127.0.0.1:8787`) | пусто (nginx `location /ai/`) |
| `EXPO_PUBLIC_AI_SIMILAR_SOURCE` | пусто (блоки «Похожие» идут к службе вместе с `EXPO_PUBLIC_AI_PICKS`) | `static` — блоки «Похожие» из слепка, без службы (#3292) |

Чтение — только `utils/aiPicksConfig.ts` (`isAiPicksEnabled`, `getAiPicksBaseUrl`, `buildAiPicksUrl`,
`getAiSimilarSource`, `isAiSimilarEnabled`, `getAiSimilarStaticUrl`).
На native адрес — origin API без `/api`. Диагностика — `utils/runtimeConfigContract.js`
(`AI_PICKS_URL_INVALID`, `AI_PICKS_LOCAL_URL_IN_PRODUCTION`, `AI_SIMILAR_SOURCE_INVALID`,
`AI_SIMILAR_SERVICE_WITHOUT_PICKS`). Без флагов ни один запрос к `/ai/*` и к слепку не уходит.

### «Похожие» без службы: статический слепок (#3292)

Блоки «Похожие статьи» (страница статьи) и «Статьи по городу» (страница квеста) не требуют ни
модели, ни вычислений в момент запроса: `GET /ai/similar` берёт готовые векторы источника и
возвращает ближайшие статьи. Этот ответ считается заранее для всех источников индекса и лежит
в репозитории одним файлом `public/assets/data/ai-similar.json` (≈ 180 КБ, ≈ 46 КБ в Brotli):
карточки статей-соседей (`cards`) один раз, у источника — список id соседей (`travel`, `quest`),
плюс `index_built_at` и `sources` для проверки свежести. Сайт раздаёт его как обычную статику —
на нынешнем сервере, без контейнера `metravel-assist` (#2457).

- Сборка: `npm run ai:similar:build` (`scripts/ai-assist/build-similar.ts` →
  `similarArtifact.ts`). Соседи считает `similarHits` (`scripts/ai-assist/search.ts`) — та же
  функция, что у `GET /ai/similar`; тест сверяет слепок с ответом службы. Сериализация
  стабильная (запись на строку, ключи по возрастанию id): правка одной статьи — короткий diff.
- Клиент: при `EXPO_PUBLIC_AI_SIMILAR_SOURCE=static` `fetchAiSimilar` читает слепок один раз на
  сессию (`loadSimilarArtifact`, без привязки к сигналу страницы) и собирает карточки по id;
  источника нет в слепке (материал новее сборки) — пустой список, блок не показывается. Явное
  `static` сильнее `EXPO_PUBLIC_AI_PICKS`; строка подбора на `/search` и «Рядом с маршрутом»
  остаются только под `EXPO_PUBLIC_AI_PICKS` — им нужен эмбеддинг запроса на сервере.
- Сборочный контракт (#2738): чанк блока попадает в сборку под литералом
  `process.env.EXPO_PUBLIC_AI_PICKS || process.env.EXPO_PUBLIC_AI_SIMILAR_SOURCE`
  (`TravelDetailsSidebarSection`); без обоих флагов Metro сворачивает ветку.
- Обновление: `npm run ai:index -- build` (индекс по текущему каталогу, инкремент) →
  `npm run ai:similar:build` → коммит файла → обычный выкат. Проверка свежести:
  `npm run guard:ai-index-freshness -- --artifact public/assets/data/ai-similar.json` (возраст и
  число статей и квестов против каталога, #3288). При выкате `scripts/deploy-prod.sh` печатает
  `⚠️`, если слепок старше 14 дней (`scripts/ai-similar-age-warning.js`), и не останавливается.
- Флаг прода живёт в `.env.prod` выкатывающей машины (как остальные `EXPO_PUBLIC_*`): на машине
  без строки `EXPO_PUBLIC_AI_SIMILAR_SOURCE=static` выкат соберёт сайт без блоков.
- Клик по карточке блока уходит событием аналитики `AiPick_Click {block: similar_travel |
  similar_quest, type, id}`.

## Ключевые компоненты

- `api/aiPicks.ts` — клиент: нормализация `items[]` (`cover` только абсолютный http(s)),
  `path` из `url` (на native `/<locale>/quests/…` → RU-маршрут квеста: локальных маршрутов там нет),
  таймаут 4 с, 404 у `/similar` = пусто.
- `hooks/useAiPicks.ts` — `useAiSimilar`, `useAiSearch`: ключи `queryKeys.aiSimilar/aiSearch`,
  `staleTime`/`gcTime` 1 ч, `retry: false`, без refetch по фокусу.
- `components/aiPicks/AiPickCard.tsx` — `UnifiedTravelCard` с квадратной обложкой по
  `CARD_MEDIA_SLOT_RATIO` (#1674; `imageHeight` — только запасная высота), подпись
  «Квест · город, страна» + опциональный `snippet`; скелет той же геометрии (`height="auto"` +
  `aspectRatio`).
- `components/aiPicks/AiSimilarSection.tsx` — блок статьи/квеста; `null` при пустом ответе,
  ошибке или выключенном флаге (без флага не создаёт запрос и подписки). Источник соседей —
  служба или статический слепок (#3292, раздел выше); блоку это безразлично.
  На телефоне показывает первые 3 из запрошенных карточек.
- `components/aiPicks/AiSearchPanelFrame.tsx` — шапка панели и `AiSearchPanelPlaceholder` для
  первого кадра `/search` (`SearchPageSkeleton`): без тяжёлых импортов, одна геометрия.
- `components/aiPicks/AiSearchPanel.tsx` — строка на `/search`: ввод ≥ 3 символов,
  дебаунс 500 мс, результаты — горизонтальный `CardRail` со `snippet`, пусто, при ошибке поле остаётся с пометкой «недоступно».
- Подключение: `TravelDetailsSidebarSection` (нулевой резерв после «Популярные», запрос с
  `nearInViewport`; кадр сайдбара не объявляется устоявшимся, пока идёт запрос
  `queryKeys.aiSimilarSource`), `app/(tabs)/quests/[city]/[questId].tsx` (`relatedTravelsSlot`),
  `ListTravelBase` (`listIntroContent` — заголовок прокручиваемого списка, только путь `/search`).

## Подсказка значений в визарде статьи (#2886)

Шаг «Дополнительно» (`components/travel/TravelWizardStepExtras.tsx`) показывает над полями
блок «Предложено по тексту»: чипы стран, категорий, транспорта, компаньонов и ночёвок, которые
`POST /ai/suggest-tags` подобрал голосованием ближайших по смыслу статей индекса (служба —
`scripts/ai-assist/suggestTags.ts`, контракт — `services/ai-assist/README.md`).

- `api/aiTagSuggestions.ts` — клиент: таймаут 4 с, `signal`, id словаря → строки формы.
- `hooks/useTravelTagSuggestions.ts` — `queryKeys.aiTagSuggestions(отпечаток текста, locale)`,
  час в кэше, `retry: false`; `enabled` только при флаге `EXPO_PUBLIC_AI_PICKS`, плоском тексте
  описания от `AI_TAG_SUGGEST_MIN_TEXT_CHARS` (300) знаков и смонтированном блоке шага.
- `components/travel/upsert/TravelTagSuggestions.tsx` — чипы `components/ui/Chip` по полям с
  подписями словаря `/getFiltersTravel/` на языке интерфейса; уже выбранные значения не
  показываются; чип добавляет значение к выбранным (`onFieldChange`), «Принять все» — все поля
  разом, «Скрыть» убирает блок до следующего монтирования. Пустой ответ, `degraded`, ошибка
  или короткий текст — блока нет. На 390 чипы переносятся строками.
- Шаг грузит блок отложенным чанком по литеральному `process.env.EXPO_PUBLIC_AI_PICKS` (#2738,
  как `PublishSeoCard` грузит помощника автора): без флага в сборке нет ни блока, ни клиента,
  запросов к `/ai/*` страница не делает.
- Аналитика (`utils/analytics.ts:trackWizardEvent`): `wizard_tag_suggestion_accepted`
  `{field, values, count, mode: chip|all, confidence}` и `wizard_tag_suggestion_dismissed`
  `{remaining, confidence}`.
- Тесты: `__tests__/scripts/ai-assist/suggestTags.test.ts` (голосование, словарь, кэш, 400,
  degraded), `__tests__/hooks/useTravelTagSuggestions.test.tsx` (условия `enabled`, ноль
  запросов без флага), `__tests__/components/travel/upsert/TravelTagSuggestions.test.tsx`.

## Планировщик поездки (#2911)

`/trips/plan/<id>` под тем же флагом показывает «Рядом с маршрутом»: статьи и квесты
индекса в 30 км от маршрута (`POST /ai/near-route`, гео-коридор по координатам
источников без модели — как `/ai/similar`), карточки `AiPickCard` с `actionSlot`
«Добавить в маршрут». Клиент — `fetchNearRoute` (`api/aiPicks.ts`, 4 с, `signal`,
прореживание до 50 точек), хук — `useAiNearRoute` (`hooks/useAiPicks.ts`, дебаунс
800 мс, ключ `queryKeys.aiNearRoute(<отпечаток точек до 3 знаков>, locale)`, exempt root
`ai-near-route`). Блок, добавление точки и черновик описания поездки
(`POST /ai/author-draft {kind: 'trip'}` под `EXPO_PUBLIC_AI_ASSISTANT`) описаны в
`docs/features/trips.md` → «Подсказки службы metravel-assist в планировщике».

## Данные

Служба отдаёт `items[] = {type, source_id, title, url, snippet, score, city, country, lat, lng, cover}`;
`cover` добавлен в индекс (#2459: `scripts/ai-index/chunk.ts`, `export.ts` берёт
`travel_image_thumb_url` статьи и `cover_url` квеста). Гео-блоки «Квесты по этому городу и
рядом» и «Путешествия по этому городу» остаются; смысловой слой закрывает связь
«статья ↔ статья». Статьи индексируются в `ru`, квесты — во всех локалях.

## Локальный стек

```bash
npm run ai:index -- build --full --out .codex-temp/ai-index   # индекс с обложками
AI_INDEX_DIR=.codex-temp/ai-index/dist npm run ai:assist:dev   # служба на 8787
npx expo start --web                                           # Metro проксирует /ai/
```

## Тесты

- `__tests__/components/aiPicks/*` — состояния блока и панели.
- `e2e/ai-picks-search.spec.ts` — `/search` с моком `/ai/search` на `dist`
  (`.env.e2e`/`.env.dev` с `EXPO_PUBLIC_AI_PICKS=1`); без флага тест пропускается явно.
- `npm run test:i18n` — namespace `aiPicksStatic` в RU/BE/UK/PL/EN.
