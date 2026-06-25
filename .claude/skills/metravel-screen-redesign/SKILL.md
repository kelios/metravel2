---
name: metravel-screen-redesign
description: >-
  Редизайн конкретной страницы/экрана MeTravel end-to-end по правилам проекта:
  фото-доминанта карточек (~70% высоты), шапка ≤20% вьюпорта на мобильном,
  ImageCardMedia (contain+blur) / UnifiedTravelCard, статичный frost вместо живого
  backdrop-blur на мобильном, токены вместо хардкода, useThemedColors / useResponsive /
  METRICS / Heading. Делегирует профильным агентам и сам верифицирует в браузере
  (mobile 390 + desktop 1280). Триггеры: «переделай дизайн <экрана>», «редизайн
  страницы travel/map/profile», «улучши вид экрана», «сделай экран красивее».
---

# metravel-screen-redesign

Раннбук редизайна **одного** экрана/страницы под существующую дизайн-систему MeTravel —
не изобретая новую. Цель: лучше иерархия/композиция/адаптив при строгом соблюдении
load-bearing правил проекта. Перед работой прочитай `CLAUDE.md`, `docs/RULES.md`,
`docs/DESIGN_HANDOFF_2026-06-02.md`.

`$ARGUMENTS` — какой экран/страница (роут или фича).

## Источники правды (импорты)

- Цвета/тема: `useThemedColors()` из `@/hooks/useTheme`; токены `DESIGN_TOKENS`
  (`@/constants/designSystem`), палитра `@/constants/modernMattePalette`.
- Адаптив: `useResponsive()` (`@/hooks/useResponsive`) → `isMobile`, breakpoints; spacing
  `METRICS` (`@/constants/layout`).
- Типографика: `<Heading level=…>` (`@/components/ui/Typography`).
- Изображения: только `@/components/ui/ImageCardMedia` (прямой `expo-image` запрещён гардом).
- Travel-карточки: только `@/components/ui/UnifiedTravelCard`.
- Внешние ссылки: только `@/utils/externalLinks.openExternalUrl`.

## Load-bearing правила (нарушать нельзя)

1. **Фото — доминанта** полноразмерной карточки (travel/место/статья/hero): ~70% высоты;
   оверлеи (♥/＋/развернуть/закрыть/бейджи/scrim) — только в углах/узкой зоной, кадр не
   затемнять. Увеличивать высоту/пропорцию фото-блока, НЕ менять `contain`+blur на `cover`.
   Исключения — компактные mini/utility/list-итемы.
2. **Шапка ≤20% вьюпорта на мобильном** (web+native, `isMobile`): фикс/sticky тулбар,
   степпер, заголовок, табы фильтров не занимают >~20% высоты. Кнопки тулбара на узком
   экране — icon-only в один ряд (подпись в `accessibilityLabel`), не вертикальным столбцом;
   убирать дублирующий заголовок, ужимать вертикальные паддинги. Полный текст — только desktop.
3. **Изображения** — `fit=contain` + shared-source blur в DOM с первого кадра; без
   `content-visibility`/offscreen/lazy-skip на web.
4. **backdrop-blur на fixed/sticky**: на мобильном — статичный фрост `colors.surfaceMuted`
   (`rgba(255,255,255,0.75)` / dark `rgba(42,42,42,0.75)`); живой `backdrop-filter` — только
   desktop. Блюр-фон слайдера НЕ удалять — оптимизировать стоимость рендера.
5. **Без хардкод-цветов** (`#fff`/`#000`/hex) — только токены/`useThemedColors`.
6. **RN Web + native совместимость** — Platform-ветвление по `docs/NATIVE_COMPAT_RULES.md`
   для всего, что попадает в native-бандл.
7. **UI-тексты на русском** (аудитория RU/BY), без англицизмов.

## Шаги

1. **Зафиксируй базу.** Запусти preview, сними экран в **390×844** и **1280×800**
   (screenshot + snapshot + console_logs). Опиши проблемы композиции/иерархии/адаптива.
2. **План редизайна** (2–5 пунктов): что меняем и под какое правило/цель. Без переизобретения
   дизайн-системы — переиспользуй существующие UI-компоненты и токены.
3. **Делегируй правки профильному агенту** по зоне: `components/travel/**`,
   `app/(tabs)/trips*`/`index.tsx` → `travel-expert`; `components/MapPage|map/**`, `app/map*`
   → `map-expert`; `app/(tabs)/profile|settings`, `components/profile/**` → `profile-expert`;
   `components/quests/**`, `app/(tabs)/quests/**` → `quest-expert`. Достижения → `achievements-expert`.
   Нарушения гардов → `guard-enforcer`.
4. **Реализуй** через токены/хуки/компоненты выше; соблюдай 7 правил.
5. **Верифицируй сам в браузере** (mobile 390 + desktop 1280): screenshot до/после,
   snapshot, console — нет ошибок, нет горизонтального скролла на mobile, шапка ≤20%,
   фото-доминанта на месте, таргеты ≥44px. Браузер-проверку НЕ перекладывать на пользователя;
   если дефолтное превью не раскладывает цель — исчерпать альтернативу (Prod Static / Playwright)
   до объявления блокера.
6. **Гарды и качество:** `npm run check:image-architecture`, `npm run guard:external-links`,
   `node scripts/verify-design-system.js`, плюс lint/typecheck/Jest затронутого scope
   (`/check-fast`).
7. **Отчёт:** что изменено (пути:line), скрин до/после mobile+desktop, какие правила соблюдены.

## Границы

- Один вызов = один экран. Не трогать SEO-разметку/контент статей (контентные скиллы).
- Не переделывать дизайн-систему — это `/metravel-design-system`.
- Сквозной аудит многих экранов — `/metravel-design-audit`.
