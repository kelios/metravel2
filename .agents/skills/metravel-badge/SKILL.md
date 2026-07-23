---
name: metravel-badge
description: >-
  Добавление/обновление значка (badge) системы достижений MeTravel: визуал
  (тир, категория, иконка, цвет), AI-промпт картинки по схеме
  docs/ACHIEVEMENTS_BADGE_PROMPTS.md, mock-каталог для локальной разработки и
  тикет на BE-seed. Триггеры: «добавь значок», «новый бейдж за <действие>»,
  «сгенерируй картинку значка», «поправь тир/иконку значка».
---

# metravel-badge

Регламент добавления и обновления одного значка (badge) системы достижений.
Источник правды по модели и контракту — `docs/ACHIEVEMENTS_DESIGN.md`; схема
картинок — `docs/ACHIEVEMENTS_BADGE_PROMPTS.md`.

Значок = запись `Badge` на бэкенде (slug, name, description, category, tier,
points, threshold, image). Фронт хранит **визуальные токены** (иконку/цвет тира)
и **моки** для локальной разработки. Картинку генерирует AI-пайплайн на бэке
(BE-A8) из промпта; пока `image_url=null` — `BadgeMedal` рисует процедурную медаль.

## Граница ответственности (важно)

- **Бэкенд НЕ правим** (репо `../metravel-backend`, владелец Sergey/Codex). Создание
  записи `Badge` и генерация картинки — это backend (management-команда `seed_badges`
  + `BadgeImageGenerator`). Наша работа на FE: визуал-токены + моки + **готовый
  AI-промпт картинки** + **тикет на BE-seed** через MCP task board (`area=back`).
- Код фичи (компоненты/хуки/типы) — агент `achievements-expert`.

## Принципы контента значка

1. **Не дублировать.** Сверь существующие значки: моки в
   `api/achievementsMock.ts` (`MOCK_BADGES`, `MOCK_PEER_CATALOG`) и прод-каталог
   `GET https://metravel.by/api/achievements/badges/`. Один `slug` = один значок.
2. **Осмысленный триггер.** Значок выдаётся за реальное измеримое действие
   (публикации, квесты, страны, лайки, подписки) — см. «Источники метрик» в
   `docs/ACHIEVEMENTS_DESIGN.md`. Для peer-значка — `target: 'user'|'travel'`.
3. **Тир соответствует усилию.** `bronze→legendary` по возрастанию порога
   (`threshold`) и очков (`points`). Серия одной темы — разные тиры, один
   `categorySlug`.
4. **Иконка и цвет из единых токенов.** Иконку выбирает `badgeIcon(categorySlug,
   slug)` в `components/achievements/badgeVisuals.ts` (Feather), цвет тира — из
   `TIER_VISUALS`. Цвета тиров обязаны совпадать с `ACHIEVEMENTS_BADGE_PROMPTS.md`.

## Шаги

### 1. Спека значка
Определи: `slug` (kebab-case, уникальный), `name`, `description` (за что выдаётся),
`categorySlug` (onboarding/writer/theme/quests/social/geo/monthly или существующая),
`tier`, `points`, `threshold` (порог метрики), `isSecret`, `order`. Для peer —
`target`.

### 2. Визуал на фронте
- Если для `categorySlug`/`slug` нет подходящей Feather-иконки в `badgeIcon()` —
  добавь slug-keyword override или category-fallback в
  `components/achievements/badgeVisuals.ts`. Покрой кейс в
  `__tests__/achievements/badgeVisuals.test.ts`.
- Новый тир/цвет — крайне редко; только синхронно с
  `docs/ACHIEVEMENTS_BADGE_PROMPTS.md` и `__tests__/achievements/api.achievements.test.ts`.

### 3. Mock-каталог (локальная разработка)
Добавь значок в `api/achievementsMock.ts` (`MOCK_BADGES` или `MOCK_PEER_CATALOG`),
по образцу соседних записей. `imageUrl: null` — НЕ подставляй фейковый URL
(рисуется процедурная медаль). Это позволяет проверить значок локально под
`EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true` до готовности бэка.

### 4. AI-промпт картинки
Собери промпт строго по схеме `docs/ACHIEVEMENTS_BADGE_PROMPTS.md`:
`BASE_STYLE + CATEGORY_MOTIF + TIER_MATERIAL + SUBJECT. FRAMING. NEGATIVE`.
- `TIER_MATERIAL` — по тиру (bronze #CD7F32 / silver #AEB6BF / gold #F2C037 /
  platinum #5BD0E0 / legendary #B06BE6).
- `CATEGORY_MOTIF` — мотив категории (звезда/перо/флаг/…).
- `SUBJECT` — конкретика значка.
- `FRAMING + NEGATIVE` — прозрачный фон, без текста, 1:1, ~80% заполнение.
Положи готовый промпт в спеку значка (в тело тикета на BE) — генерит его бэк.

### 5. Тикет на BE-seed
Через агент `ticket-board` (MCP task board, `area=back`) заведи задачу: создать
`Badge` (все поля из шага 1) + сгенерировать картинку по промпту из шага 4 +
залить в S3. Привяжи к эпику achievements (BE-A*). Без этого значок не появится в
проде (моки — только DEV).

### 6. Верификация
- Локально: `EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true`, открой /profile и галерею —
  значок виден с процедурной медалью, иконка/тир корректны.
- `npm run check:fast`; цеплял типы/`api/` — `npm run typecheck`; цеплял визуал —
  прогони `__tests__/achievements/**`.
- После закрытия BE-тикета — проверь прод-каталог и реальную картинку (через
  скилл `metravel-achievements-audit`).

## Что не делать

- Не править код/миграции бэкенда — только тикет.
- Не подставлять фейковые `imageUrl` в моках.
- Не плодить дубль `slug`; не менять цвета тиров вразрез с
  `ACHIEVEMENTS_BADGE_PROMPTS.md`.
- Не добавлять `any` в `api/`; не писать комментарии к нетронутому коду.
