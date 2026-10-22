## Why

В #2697 сервер уже локализует Badge.description, но запросы клиента не передают lang и разные языки используют один кэш. Пользователь видит прежний язык после переключения интерфейса; поздний ответ способен вернуть его снова.

## What Changes

- Catalog/me/user фиксируют применённую UI-локаль и явно передают её API.
- Locale-sensitive achievement keys сохраняют owner/public ID и различают RU/BE/UK/PL/EN; все производные reads/seeds используют соответствующую копию.
- Общие префиксы инвалидируют все языки после изменения наград; mutation rollback привязан к исходным locale/identity и не восстанавливает очищенный личный кэш.
- Существующие профиль, галерея, BadgeDetailSheet и AuthorCard показывают серверное описание без клиентского перевода и изменений геометрии.

## Capabilities

### New Capabilities

- `localized-badge-descriptions`: клиентская языковая идентичность запросов, кэшей и отображения описаний значков.

### Modified Capabilities

Нет.

## Impact

- User-visible result: описание следует активному языку и остаётся правильным при прогретом кэше, быстрой смене языка и поздних ответах.
- Platform impact: shared; обязательная production browser приёмка desktop web 1440px / mobile web 390px. Platform-specific runtime/config не затрагивается.
- Localization impact: all current locales RU/BE/UK/PL/EN; локаль — вход запроса, новые UI-ключи не планируются.
- Data/API: существующие GET /api/achievements/badges/, /me/, /user/{id}/ с lang=ru|be|uk|pl|en; shapes/auth прежние. Backend #2692 done, blockers нет. Новый caller /profile/ не добавляется.
- Task-owned paths: api/achievementsRequests.ts, api/queryKeys.ts, hooks/useAchievementsApi.ts, hooks/useGamification.ts, соответствующие cache callers/invalidators (включая QuestPioneerBlock), тесты, профильный документ и OpenSpec. Privacy contracts в identityQueryCache/queryPersist/blockSensitiveQueries сохраняются.
- Fallback/mock policy: показывать серверный RU fallback как получен; mocks только в unit, production без подмены API-текста.
- Existing behavior to preserve: owner/public identity, приватность после logout, оптимистические peer-действия, нейтральные character/progression caches и текущие Badge UI.
- Non-goals: backend/переводы, Profile.language writes, клиентский перевод, названия/ранги, peer/rare prose и place-first authorStatus, критерии/правила наград, арт, layout и protected configs.
- Accessibility/performance: существующие controls и media geometry сохраняются; без нового provider, тяжёлых зависимостей и неиспользуемых запросов.
- Security: язык не меняет auth scope; поздний rollback не возвращает данные предыдущего пользователя. SEO/analytics неприменимы: маршруты, metadata и события не меняются.
- Open questions: нет. BA и архитектурный read-only разбор подтверждают Task Contract #2697; перед apply добавить Design evidence в карточку.
