---
name: metravel-achievements-audit
description: "QA-обход достижений в браузере: ранг/XP, галерея значков, прогресс, unlock-тост, peer-награды; mock для DEV и реальный бэк. Триггеры: «проверь достижения», «QA бейджей», «ранг не считается»."
---

# metravel-achievements-audit

Регламент проверки фичи achievements/badges — что система достижений работает
end-to-end на web (и совместима с native). Чинит найденное силами агента
`achievements-expert`, не оставляет фичу в сломанном состоянии.

Полная спека поведения — `docs/ACHIEVEMENTS_DESIGN.md`. Карта кода и хуков — у
агента `achievements-expert`.

## Два режима

1. **Mock-режим (DEV, бэк не готов / изоляция UI).** `EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true`
   → `api/achievements.ts` отдаёт `MOCK_*` из `api/achievementsMock.ts`. Все
   значки с `imageUrl=null` рисуются процедурной медалью. Хорош для проверки
   вёрстки/состояний без авторизации.
2. **Реальный бэк (прод-контракт).** Без флага: хуки бьют в
   `/api/achievements/*`. `useMyAchievements()` требует Token (авторизованный QA
   из `.env.e2e`). Проверяет реальные картинки (S3) и расчёт ранга/прогресса.

## Чек-лист обхода

### Ранг и XP (`RankBar`)
- Свой профиль (`/profile`): чип уровня (gradient), название уровня, XP-счётчик,
  полоса до `nextLevelMinPoints`.
- Граничные режимы: `isMaxLevel=true` → «Максимальный уровень 🏆» без полосы;
  `nextLevelMinPoints=null` (публичный `/user/[id]`) → режим «unknown» без полосы.
- `AuthorCard` (в travel-деталях/списке): `RankBar` в `compact` + топ-значки.

### Значки (`BadgeMedal`/`BadgeGrid`/`AchievementsGalleryModal`)
- Earned — яркая медаль; locked — затемнение + замок + прогресс-полоска
  (`current/threshold`).
- `imageUrl` есть → картинка через `ImageCardMedia` (fit=contain, blur-подложка);
  `null` → процедурная медаль с верной иконкой (`badgeIcon`) и цветом тира.
- Галерея «Все»: группировка earned+locked по категориям, скролл, прогресс.

### Unlock-тост (`BadgeUnlockToast`)
- На `recentlyEarned` (за 24ч) появляется тост «Новый значок!» на ~4.5с,
  анимация входа/выхода, не повторяется в сессии (`shownBadgeIds`).
- В mock проверяется через `MOCK_MY_ACHIEVEMENTS.recentlyEarned`.

### Peer-награды (`PeerBadgeGiveButton`/`PeerBadgePickerSheet`/`PeerBadgeReceivedRow`)
- Кнопка «Наградить» открывает лист; значки отфильтрованы по `target`
  (`user`/`travel`).
- Клик по значку → оптимистичный toggle (`useGrantPeerBadge`): индикатор
  `grantedByMe` и `count` меняются сразу; при ошибке — откат (rollback).
- `PeerBadgeReceivedRow` показывает полученные значки со счётчиком (countPill).
- Нельзя наградить самого себя; повторный клик снимает награду.

### Встройки
- `/profile` — `AchievementsSection` + `BadgeUnlockToast`.
- `/user/[id]` — `UserAchievementsSection` (только earned, без XP-полосы).
- `AuthorCard` — `RankBar(compact)` + значки.
- Секции скрываются, когда данных нет (ошибка / пустой профиль) — не показывают
  пустые рамки.

## Процедура

1. Подними превью (preview_start). Для mock-режима убедись, что
   `EXPO_PUBLIC_ACHIEVEMENTS_MOCK=true` в окружении сборки.
2. Пройди чек-лист на mobile 390px и desktop 1280px: snapshot/screenshot,
   проверь console (нет ошибок) и network (хуки бьют в правильные эндпоинты,
   нет 401 там, где не должно).
3. Прокликай интерактив: открой галерею, нажми «Наградить», сделай toggle —
   подтверди оптимистичное обновление и откат при сетевой ошибке.
4. Реальный бэк: повтори ключевые пункты авторизованным QA-аккаунтом
   (`.env.e2e`, программный логин, без секретов в логах/скринах).
5. Найденное чини через агент `achievements-expert`, затем ре-верифицируй в
   браузере. После правок — `npm run check:fast`; цеплял тестируемое поведение —
   `__tests__/achievements/**`.
6. Если корень проблемы на бэке (контракт/расчёт ранга/картинка не сгенерилась)
   — не правь бэк, заведи тикет через `ticket-board` (`area=back`) и отметь
   `verify pending` с причиной.

## Что не делать

- Не отмечать «готово» без браузер-проверки (правило проекта).
- Не править бэкенд — расхождения контракта/расчёта = тикет.
- Не выводить секреты/токены в логи и скриншоты.
- Не подставлять фейковые `imageUrl` ради «красивого» скрина.

## Проверка по platform impact (обязательное правило)

Правило целиком — `docs/RULES.md` → «UI rules» (parity, web-only ветвления,
темизация, контракт карточки точки) и «Development workflow» (стадии device QA).
Без открытия документа:

- Общий файл или компонент сам по себе не создаёт device gate: shared/common responsive UI проверяется на desktop web и mobile web (~390px, `isMobile`).
- Native device QA живёт в стадии `testing` и только для Android/iOS-specific поверхности; evidence по shared UI — desktop web + mobile web.
- В мобильном вьюпорте нет web-only визуальных ветвлений; темизация тематических поверхностей — через `useThemedColors()`, не `DESIGN_TOKENS.colors.*`.
