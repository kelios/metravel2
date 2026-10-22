## Context

См. proposal.md и #2697. BA и доменный архитектор подтвердили requests:86/100/117 без lang → queryKeys:156–158 без locale → main hooks:43–69. `mapBadge` сохраняет полученное описание. Скрытые consumers: rare initialData/getQueryState, consolidated reads/seeds в useGamification и optimistic mutation context. Сервер #2692 уже принят, менять его не требуется.

## Goals / Non-Goals

Goals: одинаковый snapshot эффективной локали для request/key, полная миграция связанных consumers, all-locale invalidation и сохранность privacy/rollback.

Non-Goals: новый locale provider, клиентский перевод, изменение backend/Profile.language, UI geometry, peer/rare prose или place-first authorStatus.

## Decisions

1. Reuse `useLocaleRevision` для реактивного SupportedLocale и `getActiveLocale()` для imperative defaults. Каждый query замыкает один snapshot и передаёт его requests явно; прямой queryFn с неявным QueryFunctionContext заменить closure. Preference `system`, header и Profile.language отвергнуты: они могут отличаться от применённого UI.
2. Добавить locale последним сегментом locale-sensitive achievements keys, сохраняя root/owner/id. Обязательный аргумент ключей делает пропущенных callers видимыми TypeScript. Добавить явные family/owner/user префиксы `*All` без locale для invalidation; QuestPioneerBlock использует общий owner prefix. Альтернатива очистки одного общего кэша на language-change отвергнута: поздний ответ снова запишется под тем же ключом.
3. Перевести main hooks, rare initialData/getQueryState и consolidated gamification reads/seeds на соответствующий key. Нейтральные character/progression сохраняют owner-scoped identity и дедупликацию; локаль нужна их чтению consolidated data, а не новому обещанию перевода нейтральных payload.
4. Optimistic context хранит исходные owner/locale/keys и snapshot; rollback изменяет только исходную копию. После identity reset не восстанавливать удалённый личный кэш. Invalidation охватывает соответствующие consolidated/rare/peer получатели во всех языках без потери прежних recipients.
5. Catalog/me/user используют существующий apiClient, shapes/auth/timeout/mock policy сохраняются. GET /profile не добавляется. Серверный RU fallback сохраняется дословно. Place-first authorStatus, названия/ранги, peer/rare prose не получают новых translation semantics.
6. Галерея, недавние награды и AuthorCard сохраняют ID выбранной записи, а BadgeDetail выводят из текущих query data. Снимок Badge в локальном state удерживал бы старое описание после смены locale, даже при правильных request/key. При отсутствии текущих данных выбранный лист не показывает старый текст.

Task-owned paths: api/achievementsRequests.ts, api/queryKeys.ts, hooks/useAchievementsApi.ts, hooks/useGamification.ts, QuestPioneerBlock, AchievementsGalleryModal, RecentAwardsTab, AuthorCard и фактические связанные consumers/invalidators, соответствующие tests, docs/features/achievements.md и OpenSpec. IdentityQueryCache/queryPersist/blockSensitiveQueries меняются только если необходимо сохранить уже существующий контракт, иначе проверяются тестами.

Design evidence: docs/features/achievements.md — существующие BadgeMedal/BadgeDetailSheet, gallery, own/public profile и AuthorCard; RU/BE/UK/PL/EN, loading/error/rapid switch, desktop1440/mobile390. Новая геометрия не требуется.

## Risks / Trade-offs

- [Пропущенный cache reader] → обязательный locale argument, rg всех key callers и targeted tests derived reads/seeds.
- [Поздний rollback после language/auth change] → captured context/identity guard и deferred regression.
- [Неполная invalidation] → общие префиксы, warm всех языков и assertions по каждой копии.
- [Лишние запросы нейтральных consumers] → прежние нейтральные ключи и consolidated fallback без новых пустых callers.

## Validation matrix

До testing: пять языков × catalog/me/user request/key; RU→PL→EN→RU deferred responses; all-locale invalidation; derived seeds; optimistic failure after locale/auth switch; privacy root removal/persistence exclusion; place-first boundary. Targeted tests #2697, test:i18n, lint/typecheck и релевантные guards, затем review-auditor и code-review-gate. Ширину полного набора выбрать по фактическому diff, без runtime в review.

После commit/push/deploy: production /profile, /user/104, gallery и AuthorCard, реальные Network lang+description всех пяти языков и fallback без изменения production переводов. Скриншоты 1440/390 и console; проверка cache warming/rapid switch и личной identity. Android/iOS gate неприменим при отсутствии platform-specific изменений.

SEO/analytics неприменимы: URL, metadata и события прежние. Accessibility/media geometry сохраняются. Performance: без тяжёлых dependencies/provider и fan-out. Security: auth boundaries прежние, личный кэш не персистится и не восстанавливается после logout.

## Migration Plan

Без миграции сервера или данных. Новые ключи получают языковую идентичность; legacy personal entries удаляются существующим identity reset, persistence не сохраняет achievements. Review→explicit-path commit/push main→штатный frontend deploy→production acceptance #2697. Откат — единый task commit и штатный выкат предыдущего SHA. Архив OpenSpec только после Done gate.
