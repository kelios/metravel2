# Фича: achievements (значки, ранг, награды, прогрессия)

**Последняя актуализация:** 2026-08-17
**Ответственный:** агент `achievements-expert`; скиллы `metravel-badge` (контент значка), `metravel-achievements-audit` (QA)

## TL;DR

Геймификация профиля: пользователь получает значки за действия, копит XP и уровень
(ранг), получает награды от сообщества (peer) и от админов (rare), а также имеет
RPG-контур — линейки прогрессии, персонажа с выбором пути и бейджи первооткрывателя
места. Живёт в профиле (свой и публичный), в карточке автора статьи и в travel-detail.

## Границы фичи: пять контуров

Все пять живут в `components/achievements/**`, но это разные эндпоинты, разные
ключи React Query и разные моки. Первый вопрос при любой задаче — какой контур.

| Контур | Данные | Компоненты | Состояние |
| --- | --- | --- | --- |
| **badges** — авто-значки за критерий, ранг/XP | `/achievements/badges/`, `/achievements/me/`, `/achievements/user/{id}/` | `BadgeMedal`, `BadgeEmblem`, `BadgeGrid`, `RankBar`, `AchievementsSection`, `AchievementsGalleryModal`, `RecentAwardsTab`, `BadgeDetailSheet`, `BadgeUnlockToast` | живое; бэк отдаёт готовый rank-summary (#721) |
| **peer awards** — значки, которые выдают друг другу | `/achievements/peer-badges/`, `.../grant/`, `peer_received` в user/travel-ответах | `PeerBadgeGiveButton`, `PeerBadgePickerSheet`, `PeerBadgeReceivedRow` | эндпоинты есть, но каталог исторически приходил пустым (#577) → в DEV подставляется мок; в проде пустой каталог = пикер без вариантов |
| **rare awards** — редкие награды от админа/модератора | `/achievements/rare-awards/me/`, `/user/{id}/rare-awards/`, `/rare-awards/catalog/`, `POST /rare-awards/grants/` | `RareAwardsSection`, `UserRareAwardsSection`, `RareAwardCard`, `AdminGrantRareAward` | живое; `rare_awards` приходят top-level в консолидированном ответе, отдельные эндпоинты — fallback |
| **place-first** — «вы первооткрыватель места» | `/achievements/place-badges/me/`, `/achievements/user/{id}/place-badges/` | `PlaceFirstBadgesSection`, `PlaceFirstBadgeCard`, `PlaceFirstBadgeToast` | отдельные запросы, в консолидированный payload НЕ входят |
| **gamification** — линейки прогрессии, персонаж, выбор пути | `/achievements/progression/me/`, `/achievements/character/me/`, `POST /character/me/path/`, публичные аналоги | `ActivityProgressionSection`, `ProgressionLineBar`, `CharacterProfileCard`, `CharacterPathChoice`, `GamificationOnboarding`, `GamificationIcons` | живое; персонаж и линейки сеются из `/achievements/me/` и `/user/{id}/` (#588) |

Отдельный подконтур — **шеринг достижения** (`api/achievementsShare.ts`,
`ShareBadgeSheet`, `ShareCardPreview`, `utils/achievementShare.ts`): создание
share-карточки `POST /achievements/share-cards/`. Реального прод-подтверждения
эндпоинта в коде нет — комментарий в `api/achievementsShare.ts` прямо говорит, что до
деплоя BE (#382) отдаётся dev-мок с `og-image.jpg`.

**Ничего за feature-флагом фронта нет.** Единственный переключатель — `EXPO_PUBLIC_ACHIEVEMENTS_MOCK`
(mock-режим, см. ниже), а не флаг включения фичи. Видимость контуров регулируется
данными и ролью: `AdminGrantRareAward` виден только при `authStore.isSuperuser`,
peer-выдача — только авторизованным и не на своей цели.

## Точки входа

| Путь | Назначение |
| --- | --- |
| `components/screens/profile/ProfileOverviewTab.tsx` | свой профиль, вкладка «Обзор»: `RankProgressCard` → `AwardsHub` → `PlaceFirstBadgesSection`, засев кэшей `useSeedGamificationFromAchievements` |
| `components/screens/profile/ProfileScreen.tsx` | пилюля-счётчик значков в шапке, `BadgeUnlockToast` и `PlaceFirstBadgeToast` (оба `enabled={activeTab === 'overview'}`) |
| `components/screens/profile/PublicProfileOverviewTab.tsx` | чужой профиль: `UserAchievementsSection` + `UserRareAwardsSection` + `AdminGrantRareAward` + `GamificationProfileBlock` |
| `components/screens/profile/PublicProfileHeader.tsx` | ранг-чип «Ур. N, Титул» и кнопка «Наградить автора» (`PeerBadgeGiveButton`, скрыта на своём профиле) |
| `app/(tabs)/user/[id].tsx` | резолв userId, пилюля «Достижения» со счётчиком `rank.badgesCount`, ранг для шапки |
| `components/travel/AuthorCard.tsx` | компактный `RankBar` + топ-3 значка автора статьи, `BadgeDetailSheet` по тапу |
| `components/travel/details/TravelPeerBadgesSection.tsx` | «Награды от сообщества» под статьёй + «Наградить статью» |
| `components/quests/questWizardSections.tsx` | `BadgeUnlockToast` в прохождении квеста |
| `components/profile/RankProgressCard.tsx`, `ProfileFirstStepsCard.tsx` | карточка уровня и онбординг-карточка, обе принимают `UserRank` |

## Ключевые компоненты

```
ProfileOverviewTab (свой профиль)
 ├─ RankProgressCard ──────────── RankBar
 ├─ AwardsHub  (вкладки: path | all | recent | rare, дефолт — path)
 │   ├─ [path]   CharacterProfileCard(bare) + ActivityProgressionSection(bare)
 │   │             └─ CharacterPathChoice        └─ ProgressionLineBar
 │   ├─ [all]    AchievementsSection(bare) → RankBar + BadgeMedal×N + PeerBadgeReceivedRow
 │   │             └─ AchievementsGalleryModal → BadgeGrid → BadgeMedal → BadgeDetailSheet
 │   ├─ [recent] RecentAwardsTab → BadgeMedal + BadgeDetailSheet
 │   └─ [rare]   RareAwardsSection → RareAwardCard → ShareBadgeSheet
 └─ PlaceFirstBadgesSection → PlaceFirstBadgeCard

PublicProfileOverviewTab (чужой профиль)
 ├─ UserAchievementsSection → RankBar + BadgeGrid + PeerBadgeReceivedRow
 ├─ UserRareAwardsSection → RareAwardCard
 ├─ AdminGrantRareAward (только isSuperuser)
 └─ GamificationProfileBlock
     ├─ PlaceFirstBadgesSection
     ├─ ActivityProgressionSection
     └─ CharacterProfileCard

BadgeMedal → imageUrl ? ImageCardMedia : BadgeEmblem (SVG)
```

| Файл | LOC | Зона ответственности |
|------|-----|---------------------|
| `components/achievements/BadgeEmblem.tsx` | 409 | векторная гравюрная эмблема: мотив + рамка тира + лента, `react-native-svg` |
| `components/achievements/ShareBadgeSheet.tsx` | 407 | лист шаринга: копировать / нативный шаринг / TG / FB / WhatsApp / скачать |
| `components/achievements/GamificationIcons.tsx` | 342 | SVG-иконки RPG-контура (голова персонажа, инвентарь, лавры max-уровня) |
| `components/achievements/BadgeDetailSheet.tsx` | 312 | карточка значка: описание, дата, прогресс, гейт кнопки «Поделиться» |
| `components/achievements/AdminGrantRareAward.tsx` | 268 | админ-выдача редкой награды: пикер каталога + причина + маппинг 400/403/404/409 |
| `components/achievements/CharacterProfileCard.tsx` | 232 | персонаж: уровень, ветка, снаряжение, выбор пути |
| `components/achievements/ShareCardPreview.tsx` | 217 | превью share-карточки: `RegularFrame` vs `PremiumFrame` по `isRare` |
| `components/achievements/PeerBadgePickerSheet.tsx` | 213 | лист выдачи peer-значка с toggle |
| `components/achievements/BadgeMedal.tsx` | 209 | медаль: обводка тира, locked-скрим и замок, полоса прогресса, a11y-лейбл |
| `components/achievements/AchievementsGalleryModal.tsx` | 200 | галерея всех значков, группировка по категории, earned + locked |
| `components/achievements/badgeVisuals.ts` | 180 | токены тиров, палитры категорий, резолв мотива и Feather-иконки по slug |
| `components/achievements/AchievementsSection.tsx` | 180 | блок «все достижения» своего профиля |
| `components/achievements/ProgressionLineBar.tsx` | 178 | полоса одной линейки прогрессии |
| `components/achievements/RecentAwardsTab.tsx` | 175 | лента последних наград (`recentlyEarned` + сортировка `earned` по дате) |
| `components/achievements/GamificationOnboarding.tsx` | 171 | onboarding-карточка RPG-контура, dismiss через AsyncStorage |
| `components/achievements/PlaceFirstBadgeCard.tsx` | 159 | карточка первооткрытого места (views/saves/visits) |
| `components/achievements/RankBar.tsx` | 157 | уровень/титул + XP-полоса, три режима `max|progress|unknown` |
| `components/achievements/ActivityProgressionSection.tsx` | 154 | блок линеек + аналитика level-up |
| `components/achievements/PlaceFirstBadgeToast.tsx` | 145 | unlock-тост первооткрывателя |
| `components/achievements/RareAwardCard.tsx` | 141 | редкая награда: медаль из `rareAwardToBadge` + шаринг |
| `components/achievements/BadgeUnlockToast.tsx` | 129 | unlock-тост значка |
| `components/achievements/CharacterPathChoice.tsx` | 120 | выбор пути (4 ветки) |
| `components/achievements/AwardsHub.tsx` | 119 | единая карточка «Награды» с 4 под-вкладками |
| `components/achievements/AwardsTabBar.tsx` | 111 | таб-бар хаба |
| `components/achievements/RareAwardsSection.tsx` | 96 | свои редкие награды |
| `components/achievements/PlaceFirstBadgesSection.tsx` | 90 | свои/чужие открытые места |
| `components/achievements/UserAchievementsSection.tsx` | 89 | публичные достижения автора |
| `components/achievements/PeerBadgeReceivedRow.tsx` | 86 | ряд полученных peer-наград со счётчиками |
| `components/achievements/PeerBadgeGiveButton.tsx` | 82 | кнопка «Наградить», гейт по авторизации |
| `components/achievements/UserRareAwardsSection.tsx` | 66 | публичные редкие награды |
| `components/achievements/BadgeGrid.tsx` | 60 | сетка медалей |
| `components/achievements/SectionState.tsx` | 51 | терминальные состояния секции (без вечного спиннера) |
| `components/achievements/engravingPaper.ts` | 42 | тон бумаги/линии под light/dark, `mix()` без зависимостей |
| `components/achievements/GamificationProfileBlock.tsx` | 40 | композит RPG-блока для профиля |

Файлов >800 LOC в фиче нет. Самый крупный потребитель — `ProfileScreen.tsx` (816 LOC),
но это не файл достижений.

### API и хуки

| Файл | LOC | Зона |
|------|-----|------|
| `api/achievements.ts` | 7 | стабильный facade: реэкспорт типов, `mapRank`, `rareAwardToBadge`, requests |
| `api/achievementsTypes.ts` | 158 | доменные типы (camelCase) — контракт с бэком |
| `api/achievementsNormalizers.ts` | 422 | DTO snake_case → домен, legacy-ветки, `rareAwardToBadge` |
| `api/achievementsRequests.ts` | 300 | fetch-функции, таймауты, mock-границы |
| `api/achievementsMock.ts` | 306 | моки badges/rank/peer/rare |
| `api/achievementsShare.ts` | 107 | share-карточка + dev-мок |
| `api/gamification.ts` | 535 | типы, мапперы и fetch RPG-контура + place-first |
| `api/gamificationMock.ts` | 193 | моки place-first / прогрессии / персонажа |
| `hooks/useAchievementsApi.ts` | 278 | React Query хуки badges/peer/rare + мутации |
| `hooks/useGamification.ts` | 258 | хуки place-first/прогрессии/персонажа + засев кэшей |
| `utils/achievementShare.ts` | 65 | UTM-ссылки шаринга (`buildShareLink`, `buildShareUtm`) |
| `utils/gamificationAnalytics.ts` | 102 | 7 трекеров без PII |

## Модель данных

### Что приходит с бэка

`Badge` — `{id, slug, name, description, category{id,slug,name,icon}, tier,
image_url, image_status, award_type, target, points, is_secret, order}`.
`UserBadge` — `{id, badge, earned_at, period, discovery}`; **`id` здесь — PK записи
о разблокировке, а не `badge.id`**, и именно он уходит в `achievement_id` share-карточки.
`BadgeProgress` — `{badge, current, threshold}` для незакрытых.

`UserRank` (`rank` в ответе) — `{level, title, total_points, badges_count,
current_level_min_points, next_level_min_points, next_level_title, is_max_level,
progress_ratio, remaining_points, recomputed_at}`. Готовый rank-progress summary
приходит **на обоих** эндпоинтах — и на `/achievements/me/`, и на публичном
`/achievements/user/{id}/` (#721). Утверждение «на публичном профиле нет порогов»
устарело: `PublicAchievementsDto` объявляет `rank_levels` как legacy-fallback, а
canonical-путь — поля прямо в `rank`.

`/achievements/me/` дополнительно отдаёт top-level `activity_types[]`, `rare_awards[]`,
`character`, `progression_lines[]`. Публичный `/achievements/user/{id}/` — те же
ключи плюс `peer_received[]`. Это консолидированный payload: остальные эндпоинты
существуют только как fallback.

### Что вычисляется на клиенте

- `Badge.imageUrl` — бэк отдаёт `''` при отсутствии картинки, `mapBadge` нормализует в `null`.
- `Badge.order` — `dto.order ?? dto.id`; `categorySlug` — `?? 'other'`; `categoryName` — i18n-фолбэк.
- `tier` — валидируется по белому списку; неизвестное → `'none'` в achievements и
  **`'gold'`** в `api/gamification.ts` (у place-first другое дефолтное значение).
- `PeerBadge.target` — `'travel'` или иначе `'user'`.
- `RareAward` → `Badge` через `rareAwardToBadge`: неизвестный `level` → `legendary`,
  `imageUrl: null` всегда (редкие награды всегда рисуются процедурной эмблемой).
- `ProgressionLine.emoji` — целиком клиентский (`LINE_EMOJI` по слагу `dog|boar|fox|bird`);
  `isMaxLevel = next_level == null`.
- `CharacterState.pendingChoice` — `switch_unlocked && selected_path == null`;
  `activePathSlug` — `active_path ?? selected_path`. Маппер больше НЕ прячет
  заблокированные пути, отдаёт все с `canSelect`/`lockedReason`.
- `RankBar` считает `ratio`/`remaining` сам, только если бэк не прислал
  `progress_ratio`/`remaining_points`.
- `ProgressionLineBar` — тот же приоритет: серверные `progressPercent`/`pointsToNext`,
  иначе пересчёт из `current` и порогов.

### Legacy-ветки нормализации

1. **`mapRank` (`api/achievementsNormalizers.ts:212-268`).** `hasServerSummary()`
   проверяет наличие любого из `is_max_level | progress_ratio |
   next_level_min_points | current_level_min_points`. Если ни одного — включается
   legacy-ветка: пороги считаются из `rank_levels[]`, а `progressRatio` и
   `remainingPoints` остаются `null` (их довычислит `RankBar`). Если нет ни summary,
   ни `rank_levels` — пороги `null`, `isMaxLevel=false`, и `RankBar` **намеренно**
   не рисует XP-полосу (`mode: 'unknown'`). Это форма ответа, а не баг вёрстки.
2. **`rareAwards: null` vs `[]`.** Мапперы `mapMy`/`mapPublic` сохраняют разницу:
   `null` = поля в ответе не было (хук делает отдельный запрос), `[]` = пусто.
   Та же семантика у `characterDto`/`progressionDto`.
3. **`mapProgress`** принимает и массив, и `{lines: []}` — BE отдаёт массив.
4. **`mapRareGranter`** читает `name ?? display_name`.
5. **`normalizePeerTarget`/`normalizeLineSlug`/`normalizeActivityKind`** — все
   схлопывают неизвестное в дефолт (`user` / `dog` / `explorer`).

## Данные: React Query

Клиентского Zustand-стора у фичи нет. Читается `authStore` (`isAuthenticated`,
`userId`, `username`, `isSuperuser`). Все ключи — из `api/queryKeys.ts:89-108`
(проверяется `npm run guard:query-keys`).

| Хук | Ключ | Enabled / особенности |
|-----|------|-----------------------|
| `useBadgeCatalog` | `['achievements','badges']` | всегда |
| `useMyAchievements` | `['achievements','me']` | `isAuthenticated && options.enabled`; таймаут запроса 15 000 мс |
| `useUserAchievements` | `['achievements','user',userId]` | `userId != null`; запрос идёт `skipAuth` |
| `usePeerBadgeCatalog` | `['achievements','peer-catalog']` | всегда |
| `useTravelPeerBadges` | `['achievements','travel-peer',travelId]` | `travelId != null`, `skipAuth` |
| `useMyRareAwards` | `['achievements','rare','me']` | только если в `/me/` не было `rare_awards`; `initialData` — из кэша `achievementsMe` |
| `useUserRareAwards` | `['achievements','rare','user',userId]` | аналогично, из кэша `achievementsUser` |
| `useRareAwardCatalog(enabled)` | `['achievements','rare','catalog']` | включается только когда открыт админ-пикер |
| `useMyPlaceFirstBadges` | `['gamification','place-badges','me']` | `isAuthenticated` |
| `useUserPlaceFirstBadges` | `['gamification','place-badges','user',userId]` | `userId != null` |
| `useMyGamificationProgress` | `['gamification','progress','me']` | fallback-запрос; `initialData` = `mapProgress(cached.progressionDto)` |
| `useUserGamificationProgress` | `['gamification','progress','user',userId]` | то же от `achievementsUser` |
| `useMyCharacter` | `['gamification','character','me']` | fallback-запрос; `initialData` = `mapCharacter(cached.characterDto)` |
| `useUserCharacter` | `['gamification','character','user',userId]` | то же |

`staleTime` везде 5 минут. `retry` — не более 2 попыток и никогда на 401/403,
`AbortError` и таймауте (`isTimeoutError`): достижения — deferred-секция, и повтор
зависшего бэка утраивал мёртвое ожидание под спиннером.

`MY_ACHIEVEMENTS_TIMEOUT = 15000` (`api/achievementsRequests.ts:61`) — единственный
кастомный таймаут фичи, defensive-мера после #721 (раньше было 25 с, когда ранг
пересчитывался на каждый GET).

### Инвалидация

- `useGrantRareAward` → `invalidateQueries` по `achievementsRareUser(input.userId)`
  и `achievementsRareMe()`.
- `useGrantPeerBadge` — **не инвалидирует**, а правит кэш точечно (см. ниже).
- `useChooseCharacterPath` → `setQueryData(gamificationCharacterMe, next)` + событие
  `path_chosen`.
- `useSeedGamificationFromAchievements(enabled)` — вызывается в `ProfileOverviewTab`;
  засевает `gamificationCharacterMe` и `gamificationProgressMe` из уже загруженного
  `/achievements/me/`, но только если в этих кэшах пусто, и с `updatedAt` исходного
  запроса. Это фикс #588, где вкладка «Ваш путь» дублировала два медленных вызова.

Никакой инвалидации `achievementsMe` после публикации статьи, прохождения квеста
или лайка на фронте нет: значки появляются на следующем нестейл-фетче. Отсюда
типовой симптом «ранг не обновился».

## Peer-награды: оптимистичный toggle

`useGrantPeerBadge` (`hooks/useAchievementsApi.ts:230-278`) — единственная мутация с
оптимистичным обновлением.

- `onMutate` определяет цель по `input.travelId != null`: либо кэш
  `achievementsTravelPeer(travelId)` (список `PeerBadgeReceived[]`), либо
  `achievementsUser(recipientId)` (поле `peerReceived` внутри `PublicAchievements`).
  Перед правкой — `cancelQueries`, снимок предыдущего значения в контекст.
- `togglePeer()` переключает `grantedByMe` и двигает `count` на ±1, а если значка в
  списке ещё нет — добирает его из кэша `achievementsPeerCatalog` и вставляет с
  `count: 1`. Если каталога в кэше нет, элемент не добавится и оптимистичного
  отклика не будет.
- `onError` откатывает ровно ту ветку, которую правил.
- `onSuccess` перезаписывает `grantedByMe`/`count` серверными значениями.

Гейты выдачи: `PeerBadgeGiveButton` рендерит `null` для неавторизованных;
`PublicProfileHeader` прячет кнопку на своём профиле; `TravelPeerBadgesSection`
прячет и кнопку, и всю секцию на своей статье при нуле наград. `PeerBadgePickerSheet`
фильтрует каталог по `target` — значки `user` и `travel` не смешиваются.

## Mock-режим

Флаг **`EXPO_PUBLIC_ACHIEVEMENTS_MOCK`** — общий для `achievementsRequests.ts`,
`achievementsShare.ts` и `gamification.ts`, разрешается через
`utils/devMockFlags.ts::resolveDevMockFlag`. Флаг объявлен в
`utils/runtimeConfigContract.js`; в `.env*` его нет, включается точечно:
`EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true npm run web` либо через профили в
`.claude/launch.json`. `resolveDevMockFlag` **бросает** ошибку, если флаг выставлен
не в DEV — фейковые данные в прод не попадают этим путём.

Два разных поведения:

1. **Флаг включён** — fetch-функции вообще не ходят в сеть, сразу возвращают
   `MOCK_*` (11 значков, ранг 4/«Бывалый» с 480 XP, peer-каталог, редкие награды,
   4 линейки прогрессии `dog|boar|fox|bird`, персонаж). `imageUrl` во всех моках
   **намеренно `null`** —
   рисуется векторная эмблема; подстановка фейкового URL прячет реальный дефект
   отдачи картинок.
2. **Флаг выключен, но `__DEV__`** — `shouldFallbackToMock(error)` подменяет ответ
   моком на статусах **0, 404, 501**. В проде эта ветка мертва (`if (!__DEV__) return false`).

Чем опасен: **mock маскирует прод-ошибки**. Расширение списка статусов или снятие
условия `__DEV__` превращает прод-500 в красивый экран с фейковыми значками, а
«работает под моком» ничего не доказывает про бэкенд. Два места уже отступают от
чистой схемы и требуют внимания:

- `fetchPeerBadgeCatalog` — при `200 + []` в DEV подставляет мок-каталог (#577,
  «Наградить» открывался без вариантов). В проде пустой массив отдаётся как есть.
- `grantPeerBadge` — симулирует `{granted: true, count: 1}` не только на 0/404/501,
  но и на **400**, потому что slug мок-значка бэку неизвестен. Настоящая
  валидационная 400 от живого бэка в DEV будет проглочена.
- `grantRareAward` — симулирует выдачу только по `shouldFallbackToMock`;
  400/403/404/409 пробрасываются и раскладываются в текст в `AdminGrantRareAward`.

## Флоу выдачи, unlock-тост, шеринг

Выдача значков — целиком бэкенд (`AchievementEngine`, см. `docs/ACHIEVEMENTS_DESIGN.md` §4).
Фронт узнаёт о новых значках через `recently_earned` в `/achievements/me/`.

`BadgeUnlockToast`: берёт первый элемент `recentlyEarned`, которого нет в
модульном `Set<number> shownBadgeIds`, показывает 4500 мс с fade+spring, тап
закрывает. Сет живёт в памяти модуля — при полной перезагрузке страницы тост может
показаться повторно (осознанное упрощение v1). `PlaceFirstBadgeToast` устроен так же,
но фильтрует по `isFresh` (бэк ставит флаг для открытых за сутки) и дополнительно
шлёт `trackPlaceFirstBadgeEarned`. Оба смонтированы в `ProfileScreen` с
`enabled={activeTab === 'overview'}`; `BadgeUnlockToast` ещё и в мастере квеста.

Шеринг: `BadgeDetailSheet` показывает кнопку только при
`earned && ownerName && userBadgeId != null` и передаёт `achievementId = userBadgeId`
(PK разблокировки). `ShareBadgeSheet` вызывает `createShareCard({achievementId,
template: isRare ? 'rare' : 'default', utm})`, показывает `ShareCardPreview`
(`PremiumFrame` для редких), и открывает каналы **только** через
`@/utils/externalLinks` (гвард `guard:external-links`). Ссылка = `public_url` или, если
его нет, `image_url`, с UTM от `buildShareLink`. События — `badge_share_opened`,
`badge_shared`, `share_card_click`.

## Визуальный контракт значка

Значок рисуется **векторно по умолчанию**; `image_url` — опциональный media-override.

```
BadgeMedal
 ├─ badge.imageUrl ≠ null → ImageCardMedia(fit="contain", borderRadius=size/2)
 │                          + круглая обводка цвета тира (borderWidth ≈ size*0.045)
 └─ badge.imageUrl == null → BadgeEmblem (react-native-svg, viewBox 100×100)
```

`BadgeEmblem` собирается из трёх независимых слоёв (`components/achievements/badgeVisuals.ts`):

- **Тир → сложность рамки** (`TIER_FRAME`), а не «блеск»: `bronze → plain`,
  `silver → double`, `gold → laurel`, `platinum → ornate`, `legendary → rays`.
  Цвета тира (`ring`/`highlight`/`shade`) — в `TIER_VISUALS`, они же идут на обводку
  media-варианта и на заливку полосы прогресса.
- **Категория → палитра бумаги** (`CATEGORY_PALETTES`: onboarding / writer / theme /
  quests / social / geo / monthly / community / other, дефолт `other`).
  `engravingPaper.ts` смешивает тон под тёмную тему (тёплая сепия `#2A2117`,
  линия `#F0E2C8`) — не нейтральный чёрный.
- **Мотив линии** (`badgeMotif`): сначала regex-хинты по slug (в т.ч. кириллические —
  `профиль`, `поход`, `вело`, `квест`, `маршрут`, `стран`), первое совпадение
  выигрывает; иначе дефолт по категории. Отдельно живёт `badgeIcon()` — Feather-иконка
  для legacy-потребителей и a11y.

Locked-значок: `opacity 0.5` + скрим + бейдж-замок в углу + полоса
`current/threshold` под медалью. Медиа значка обязано идти через `ImageCardMedia`
(правило проекта, прямой `expo-image` в фиче запрещён).

Промпты AI-картинок — `docs/ACHIEVEMENTS_BADGE_PROMPTS.md`, добавление значка —
скилл `metravel-badge`.

## Где встроено и как считаются счётчики

- **Пилюля «Достижения»** в `app/(tabs)/user/[id].tsx` — значение
  `userAchievementsQuery.data?.rank?.badgesCount ?? 0`, тап ведёт на вкладку «Обзор».
  То же поле — источник счётчика в `ProfileScreen`.
- **Ранг в шапке** имеет два источника: `profile.rank_summary` (нормализуется
  `mapProfileRank` в `api/user.ts` через тот же `mapRank`) даёт первый paint без
  ожидания achievements-запроса, затем перекрывается `achievements.rank`. В
  `ProfileScreen` это важно вдвойне: `useMyAchievements` там включён только на
  вкладке «Обзор».
- **Счётчик peer-награды** — `count` из `peer_received[]`, отображается как «Значок ×N».
- **Прогресс значка** — `current/threshold` из `progress[]`, ratio считает `BadgeMedal`.
- **Уровень персонажа** — `active_path.level.level ?? 1`, не сумма XP.
- XP значков и XP линеек прогрессии — разные шкалы: `UserRank.totalPoints` (сумма
  `points` значков) и `ProgressionLine.current` (метрика активности).

## Кросс-платформенность

Отдельных `.web.tsx`/`.native.tsx` в фиче нет — один бандл на web, Android и iOS.
Платформенные ветки точечные:

- `BadgeEmblem.tsx:385` и `GamificationIcons.tsx:32` — декоративный SVG скрывается от
  скринридера по-разному: `aria-hidden`/`focusable` на web против
  `accessibilityElementsHidden`/`importantForAccessibility` на native.
- `ShareBadgeSheet` — на web использует Web Share API и `downloadUrlOnWeb`, на native
  `Share` из RN; `minHeight` кнопки 48 на Android против 44 на iOS.
- `GamificationOnboarding` хранит dismiss в `AsyncStorage` (работает на всех платформах).

Анимации тостов — `Animated` с `useNativeDriver: true`. Прочее — RN-примитивы,
`DESIGN_TOKENS`, `useThemedColors`, `expo-linear-gradient`, `react-native-svg`.

## Тесты

- Unit/компонентные: `__tests__/achievements/` — `api.achievements.test.ts`,
  `api.achievements.peer.test.ts`, `api.gamification.test.ts`, `api.rareAwards.test.ts`,
  `badgeVisuals.test.ts`, `achievementShare.test.ts`, `useGamification.test.tsx`,
  `RankBar.test.tsx`, `BadgeMedal.test.tsx`, `BadgeDetailSheet.test.tsx`,
  `PeerBadgePickerSheet.test.tsx`, `PeerBadgeReceivedRow.test.tsx`,
  `ProgressionLineBar.test.tsx`, `RareAwardCard.test.tsx`,
  `AdminGrantRareAward.test.tsx`, `CharacterProfileCard.test.tsx`,
  `ShareBadgeSheet.test.tsx`, `ShareCardPreview.test.tsx`, `AwardsHub.test.tsx`.
- Встройки: `__tests__/components/travel/AuthorCard.achievements.test.tsx`,
  `__tests__/components/profile/RankProgressCard.test.tsx`,
  `__tests__/api/user.mapProfileRank.test.ts`.
- E2E: `e2e/profile-awards-hub.spec.ts` (все 4 вкладки хаба на desktop и mobile,
  отсутствие вечного спиннера, лента `recent`, открытие `BadgeDetailSheet`),
  `e2e/public-profile-inline-sections.spec.ts`, `e2e/profile-redesign-587-590.spec.ts`.
- Гварды: `npm run guard:query-keys` (ключи только из `api/queryKeys.ts`),
  `guard:external-links` (шеринг), `guard:touch-targets`.

Не покрыто автотестами: rollback оптимистичного peer-toggle против живого сервера,
поведение `PlaceFirstBadgeToast`, реальный `createShareCard` против бэка.

## Известные ловушки

- **Mock маскирует прод-ошибку.** Расширение `shouldFallbackToMock` или снятие
  `__DEV__` = фейковые значки поверх 500. `grantPeerBadge` уже глотает 400.
- **Двойной кэш peer-toggle.** Мутация правит либо `achievementsTravelPeer`, либо
  `achievementsUser`; если rollback починит не ту ветку, в UI останется награда,
  которой на сервере нет.
- **`achievement_id` шеринга — это `UserBadge.id`, не `Badge.id`.** Каталожный id
  даёт 403 «achievement not shareable». Моки специально держат смещение +100.
- **`rank` без порогов — не баг вёрстки.** `RankBar` в режиме `unknown` намеренно
  не рисует полосу; чинить надо форму ответа, а не компонент.
- **`ACH-CACHE-001`** (`docs/PROBLEM_MEMORY.md`): холодный `/achievements/me/`
  доходил до 3.5 с; FE-таймаут 15 с — защита, а не решение. Симптом «ранг не
  обновился» часто = кэш, а не расчёт.
- **`imageUrl: null` в моках намеренно.** Подстановка URL ломает `BadgeMedal` и
  прячет дефект отдачи картинок.
- **Разные дефолты тира.** `api/achievementsNormalizers.ts` схлопывает неизвестный
  тир в `none`, `api/gamification.ts` — в `gold`.
- **Инлайновый строковый query-ключ** вместо `api/queryKeys.ts` = мутация
  инвалидирует не тот кэш, «значок появляется только после перезагрузки». Ловится
  `guard:query-keys`.
- **`useMyAchievements` в `ProfileScreen` включён только на вкладке «Обзор»** —
  на других вкладках ранг берётся из `profile.rank_summary`; расхождение между ними
  выглядит как «два разных уровня».
- **Пустой peer-каталог в проде** не выдаёт ошибку: пикер открывается с пустым
  состоянием (#577).

## Внешние зависимости

- Эндпоинты: `/achievements/badges/`, `/achievements/me/`, `/achievements/user/{id}/`,
  `/achievements/travel/{id}/`, `/achievements/peer-badges/`,
  `/achievements/peer-badges/grant/`, `/achievements/rare-awards/me/`,
  `/achievements/user/{id}/rare-awards/`, `/achievements/rare-awards/catalog/`,
  `/achievements/rare-awards/grants/`, `/achievements/share-cards/`,
  `/achievements/place-badges/me/`, `/achievements/user/{id}/place-badges/`,
  `/achievements/progression/me/`, `/achievements/user/{id}/progression-lines/`,
  `/achievements/character/me/`, `/achievements/user/{id}/character/`,
  `/achievements/character/me/path/`. Плюс `rank_summary` в `/api/user/{pk}/profile/`.
- Env: `EXPO_PUBLIC_ACHIEVEMENTS_MOCK` (dev-only).
- Библиотеки: `@tanstack/react-query`, `react-native-svg`, `expo-linear-gradient`,
  `expo-clipboard`, `@react-native-async-storage/async-storage`, `@expo/vector-icons/Feather`.

## Открытые вопросы и зависимости `area=back`

Установить по коду не удалось, требуется runtime-evidence или бэкенд-репозиторий:

1. **Задеплоен ли `POST /achievements/share-cards/` на проде.** В коде только
   комментарий «пока BE #382 не задеплоен» и dev-мок. Публичная страница
   `/achievements/{public_slug}` и `.png`-рендер во фронте не вызываются вовсе.
2. **Отдаёт ли прод непустой peer-каталог.** DEV-подмена по `200 + []` (#577)
   всё ещё в коде — значит на момент её написания каталог был пуст. Актуальное
   состояние не проверено.
3. **Приходят ли `rare_awards` / `character` / `progression_lines` top-level в
   каждом прод-ответе** или fallback-запросы регулярно срабатывают.
4. **Реально ли включён `is_fresh` у place-first бейджей на бэке** — от него зависит
   единственный триггер `PlaceFirstBadgeToast`.
5. **Кто и когда инвалидирует `/achievements/me/` после действия пользователя.**
   На фронте инвалидации нет; лаг появления значка = `staleTime` 5 минут плюс кэш бэка
   (`ACH-CACHE-001`).
6. **Нет FE-запроса за `rank_levels` отдельно** — если бэк однажды перестанет слать
   summary в публичном ответе, legacy-ветка сработает только там, где пришёл
   `rank_levels`; полнота этого поля на публичном эндпоинте не проверена.
7. **Rate-limit и анти-абьюз peer-выдачи** описаны в дизайн-доке, но во фронте нет
   ни обработки 429, ни throttling на кнопке.
8. **`grantPeerBadge` глотает 400** — как только каталог станет реальным, это надо
   снять, иначе валидационные ошибки бэка не будут видны в DEV.

## Связанные документы

- `docs/ACHIEVEMENTS_DESIGN.md` — контракт бэка, `AchievementEngine`, каталог значков, §10 peer.
- `docs/ACHIEVEMENTS_BADGE_PROMPTS.md` — схема AI-промптов картинок значков.
- `docs/features/social-trips-gamification-roadmap.md` — контракт RPG-контура
  (линейки, персонаж, place-first).
- `docs/features/user.md` — встройка в профиль, `rank_summary`.
- `docs/PROBLEM_MEMORY.md` → `ACH-CACHE-001`.
- `.claude/skills/metravel-badge/SKILL.md` — добавление значка.
- `.claude/skills/metravel-achievements-audit/SKILL.md` — QA-обход фичи в браузере.
