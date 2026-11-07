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

Чтение — только `utils/aiPicksConfig.ts` (`isAiPicksEnabled`, `getAiPicksBaseUrl`, `buildAiPicksUrl`).
На native адрес — origin API без `/api`. Диагностика — `utils/runtimeConfigContract.js`
(`AI_PICKS_URL_INVALID`, `AI_PICKS_LOCAL_URL_IN_PRODUCTION`). Без флага ни один запрос к
`/ai/*` не уходит.

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
  ошибке или выключенном флаге (без флага не создаёт запрос и подписки).
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
