## 1. Фаза 1 — проект, пробы источников, сборочные скрипты

- [x] 1.1 Пробы источников с числами: перечень Wikidata и OSM, время и размер Overpass на эталонах, набор высоты GLO-30 и GLO-90, лицензия и правило климата, размер индекса (`.codex-temp/3357/work/`).
- [x] 1.2 Скрипты `scripts/ai-index/world/`: `net`, `wikidata`, `overpass`, `geo`, `dem`, `elevation`, `climate`, `season`, `effort`, `references`, `cards`, `pipeline`, `build` (команды `list`, `refs`, `build`, `embed`, `manifest`).
- [x] 1.3 Юнит-тесты чистых функций без сети: `__tests__/scripts/ai-index/world-geometry.test.ts`, `world-facts.test.ts`, фикстура `world.fixture.ts`.
- [x] 1.4 Сверка четырёх эталонов командой `refs` на GLO-30 и GLO-90.
- [x] 1.5 Утверждение проекта архитектором: решения по открытым вопросам внесены в `design.md`.

## 2. Данные

- [ ] 2.1 Полная сборка первой версии (`build --all`), `embed` моделью индекса сайта, `manifest`; сводка сборки с пропущенными маршрутами и причинами. Первый ночной проход запущен 14.11.2026 (`.codex-temp/3357/night-build.sh 1`); проход ограничен 900 МБ и 1 500 запросами Overpass, следующие проходы продолжают с кэша.
- [x] 2.2 Фикстура внешнего индекса из 14 маршрутов для тестов службы и экрана: `__tests__/fixtures/worldTrails.ts` (эталоны, короткие маршруты, оценочные дни, ступень по разметке, сезон южного полушария).
- [x] 2.3 Скрипт npm `ai:index:world` в `package.json`; потолок прохода Overpass, очередь экземпляров, кэш профилей высот, проверка ответа Overpass до записи в кэш.
- [ ] 2.4 Публикация слоя ODbL после полной сборки: `trails-osm.jsonl` → `public/assets/data/world-trails-osm.jsonl`, выкат фронта, `AI_WORLD_LAYER_URL` у службы.

## 3. Контракты и условия вопроса

- [x] 3.1 `api/aiAssist/trailFacts.ts`: карточка `AiWorldTrail` (вид `trail`, группа `world`), разбор карточки из потока, ступени и шкала SAC одним словарём со сборкой, строка фактов; ссылка на тип из `api/aiAssist/types.ts`.
- [x] 3.2 `api/aiAssist/questionConditions.ts`: ветка `trail` в `judgeCard` — месяцы, дни с запасом для оценки, вид маршрута, длина, «для новичков»; тесты `__tests__/api/aiAssist/worldTrails.test.ts`.
- [x] 3.3 `api/aiAssist/worldTrails.ts`: подбор второго яруса — условие включения, место, порядок, предел трёх карточек.

## 4. Служба `/ai/ask`

- [x] 4.1 Загрузка внешнего индекса: `AI_WORLD_INDEX_DIR` и `AI_WORLD_LAYER_URL` в `scripts/ai-assist/config.ts`, `scripts/ai-assist/worldIndex.ts`, `scripts/ai-assist/main.ts`; служба без индекса стартует как раньше.
- [x] 4.2 Подбор второго яруса в `scripts/ai-assist/app.ts` (`retrieve`) тем же вектором запроса; поле `world` в `RetrievalResult`.
- [x] 4.3 Поток `scripts/ai-assist/ask.ts`: внешние карточки в событии `sources`, ход без материалов сайта, `removed_world_links` в `done`, `world` в `trace`, `world_ids` в журнале хода (`scripts/ai-assist/demandLog.ts`).
- [x] 4.4 `/ai/health`: число маршрутов, фрагментов и дата сборки внешнего индекса.

## 5. Страж

- [x] 5.1 `api/aiAssist/linkGuard.ts`: внешние карточки ответа, внешний адрес только при полном совпадении, счётчик `removedWorld`.
- [x] 5.2 `api/aiAssist/answerGuard.ts`, `answerGuardRules.ts`: проброс внешних карточек и счётчика; вызовы в `scripts/ai-assist/ask.ts`.
- [x] 5.3 Тесты на обход: внешняя ссылка вне внешних карточек вырезается; ссылка на внешнюю карточку остаётся с её названием; число о внешнем маршруте без опоры убирается; правила для карточек сайта не изменились.

## 6. Экран и локализация

- [x] 6.1 Клиент потока `api/aiAssist/askProvider.ts`: маршруты мира, адрес слоя, `removedWorldLinks`; состояние хода в `components/screens/assistant/useAssistantChat.ts`.
- [x] 6.2 Блок «Ещё в мире»: `components/screens/assistant/AssistantWorldTrails.tsx`, место — `AssistantTurnCard.tsx`; стили в `assistantStyles.ts`; ссылка через `openExternalUrlInNewTab`.
- [x] 6.3 Ключи `aiAssistStatic:ask.world*` на пяти локалях.
- [x] 6.4 Тесты экрана `__tests__/screens/assistant/AssistantWorldTrails.test.tsx`.

## 7. Оценка, замеры, документ фичи

- [x] 7.1 Группа `world` в `scripts/ai-assistant-eval/cases.live.jsonl` (13 вопросов о маршрутах на пяти языках и 4 контрольных), проверки `checkWorld` в `checks.mjs`, опись `eval-inventory.json` заморожена заново.
- [ ] 7.2 Прогон `npm run ai:assistant:eval` на группе `world` и прежнем наборе, три повтора — в `testing`, на живой модели и полном индексе.
- [ ] 7.3 Память и время службы с внешним индексом и без него (`/ai/health`, `npm run ai:assist:bench`); таблица в `.codex-temp/3357/` и значение в карточке борда — в `testing`.
- [x] 7.4 `docs/features/ai-assistant.md` — раздел «Маршруты мира (#3357)», известные боли, тесты; `services/ai-assist/README.md` — переменные и здоровье.
- [x] 7.7 Дефекты приёмки 14.11.2026: места маршрута ниже страны в слое Wikidata (`places`), место вопроса по газеттиру индекса («в Шотландии», «на Корсике», «в Альпах»), вопрос-название маршрута, состояние раскрытия у кнопки источников, проверка языка ссылки; вопросы группы `world` дополнены, опись заморожена заново.
- [ ] 7.8 После окончания ночных проходов: `list` (места — из кэша Wikidata), `build --all --offline --dist .codex-temp/3357/dist-v1`, `embed`, `manifest`.
- [ ] 7.5 Независимое ревью полного diff.
- [ ] 7.6 После перехода в `testing`: экран на 390 и 1280 px, сценарии «Как протестировать» карточки #3357.
