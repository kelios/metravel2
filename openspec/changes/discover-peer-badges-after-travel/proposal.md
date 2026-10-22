## Why

#2678 требует заметного приглашения наградить автора после чтения статьи. Source-разведка подтверждает: существующая кнопка скрыта у гостя, находится в отложенном блоке и выдаёт награду статье (`target=travel`). Причина низкой активности ещё не доказана; до реализации фиксируется browser baseline.

## What Changes

- Shared приглашение непосредственно после основного текста, перед следующими секциями и автором: «Понравилась статья? Наградите автора значком» и подписанная кнопка.
- Читатель открывает существующий выбор награды пользователю; автор своей статьи, неизвестный получатель и незавершённая авторизация исключены.
- Гость переходит на вход/регистрацию с сохранением адреса возврата к статье; автоматической выдачи нет.
- `peer_badge_prompt_impression` и `peer_badge_prompt_click` с `travel_id`, без персональных данных.
- Тексты RU/BE/UK/PL/EN; loading/error/retry для затронутого выбора. Ошибка grant 400 в production не симулирует успешную награду.
- Персонализированное состояние наград автора и статьи читается с текущей сессией и отдельным кэшем зрителя; анонимный ответ не подменяет `grantedByMe` вошедшего пользователя.

Non-goals: новые значки, тексты каталога, backend/антиабьюз-правила, изменение прежних наград статье и других призывов.

## Capabilities

### New Capabilities

- `article-author-peer-badge-prompt`: обнаружение награды автору после чтения, вход гостя с возвратом и события.

### Modified Capabilities

Нет.

## Impact

- Platform impact: shared; обязательны desktop web 1440 и mobile web 390. Отдельного native behavior/config/runtime нет, device gate нужен только при его появлении.
- Localization impact: RU/BE/UK/PL/EN через i18n; API-контент не переводится клиентом.
- Paths: `components/travel/details/sections/`, `PeerBadgeGiveButton.tsx`, `PeerBadgePickerSheet.tsx`, growth analytics, locales, focused tests; personalized reads/grant error в `api/achievementsRequests.ts`, viewer keys в `api/queryKeys.ts`, их hooks/initial-data consumers в `useAchievementsApi.ts` и `useGamification.ts` после освобождения #2697.
- Data/API: существующие peer catalog, public author achievements и grant endpoint, без нового контракта. `target=user`, `recipient_id`, без `travel_id` в grant.
- Dependencies: #350–352 и #2670 done; чужие изменения #2697 сохраняются. Mock policy: fixtures только в tests; приёмка по реальному POST и persisted GET.
- Accessibility: читаемая подписанная кнопка, keyboard/focus и переносы пяти локалей. Performance: без новых изображений и eager hero-загрузок; используется существующий picker и query cache.
- Security: внутренний sanitised redirect, без guest grant и fake-success на ошибке API. Analytics не содержит имени, email или текста статьи.
- SEO: canonical, metadata, media, robots/sitemap не меняются.

Прямое «делай» разрешает planning → apply; external operation gates сохраняются.
