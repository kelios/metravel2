---
name: metravel-page-new
description: >-
  Создание новой страницы/лендинга MeTravel с нуля от идеи/макета: роут Expo Router,
  структура секций, hero, переиспользование компонентов дизайн-системы (ImageCardMedia/
  UnifiedTravelCard/Heading), адаптив через useResponsive, тема через useThemedColors,
  SEO-мета, RN Web + native совместимость и браузер-верификация. Триггеры: «сделай новую
  страницу <X>», «лендинг для <фичи>», «добавь экран с нуля», «собери посадочную страницу».
---

# metravel-page-new

Раннбук создания **новой** страницы/лендинга на существующей дизайн-системе MeTravel.
Не изобретать новую визуалку — собирать из канонических компонентов и токенов. Перед
работой прочитай `AGENTS.md`, `docs/RULES.md`, `docs/DESIGN_HANDOFF_2026-06-02.md`.

`$ARGUMENTS` — что за страница (назначение, контент, есть ли макет/референс).

## Источники правды (импорты)

- Роутинг: Expo Router, файловый — экран кладётся в `app/` (`app/(tabs)/…` для таба).
  Web/native варианты — `*.web.tsx` / `*.native.tsx` при расхождении.
- Контейнеры/раскладка: `components/layout/ResponsiveContainer`, `ResponsiveStack`.
- Цвета/тема: `useThemedColors()` (`@/hooks/useTheme`); токены `DESIGN_TOKENS`.
- Адаптив: `useResponsive()` → `isMobile`/breakpoints; spacing `METRICS` (`@/constants/layout`).
- Типографика: `<Heading level=…>` (`@/components/ui/Typography`).
- Изображения: только `ImageCardMedia`; travel-карточки: только `UnifiedTravelCard`;
  внешние ссылки: только `externalLinks.openExternalUrl`.

## Шаги

1. **Бриф → структура.** Сформулируй цель страницы и сетку секций (hero → блоки →
   CTA → футер). Каждая секция = существующий компонент/паттерн, а не новый с нуля.
2. **Создай роут** в `app/…`. Если страница встраивается в фичу — делегируй профильному
   агенту (travel/map/quest/profile-expert); самостоятельная посадочная — собери из
   `components/ui` + `components/layout`.
3. **Hero и карточки** — соблюдай фото-доминанту (~70% высоты в полноразмерной карточке,
   contain+blur, оверлеи в углах), шапку ≤20% вьюпорта на мобильном (icon-only ряд),
   статичный frost вместо живого backdrop-blur на мобильном.
4. **Адаптив:** один источник — `useResponsive`; spacing/радиусы из `METRICS`; колонки через
   `useResponsiveColumns`. Проверь 390 / 768 / 1280.
5. **Тема:** все цвета через `useThemedColors` (light+dark), без хардкода.
6. **SEO-мета** (если страница публичная web): title/description/og по образцу существующих
   страниц; per-page мета на билде. Не выдумывать данные — реальный контент.
7. **RN Web + native:** Platform-ветвление по `docs/NATIVE_COMPAT_RULES.md`; без web-only
   API без гейта в общем бандле.
8. **Верифицируй сам** в браузере (mobile 390 + desktop 1280): screenshot, snapshot,
   console — нет ошибок, нет горизонтального скролла, таргеты ≥44px. Не перекладывать
   проверку на пользователя; не раскладывается дефолтное превью — исчерпать альтернативу
   (Prod Static / Playwright).
9. **Гарды/качество:** `npm run check:image-architecture`, `guard:external-links`,
   `node scripts/verify-design-system.js`, lint/typecheck/Jest scope.
10. **Отчёт:** роут, секции, скрин mobile+desktop, какие компоненты переиспользованы.

## Границы

- UI-тексты на русском (аудитория RU/BY).
- Не дублировать существующие экраны — сначала проверь, нет ли готового паттерна.
- Изменение существующего экрана — `/metravel-screen-redesign`; токены/каталог —
  `/metravel-design-system`.
- Контент-страница из фото-архива (статья-путешествие) — это `/metravel-travel-article`.

## Паритет mobile web ↔ устройство (обязательное правило)

«Мобильная версия» = mobile web (~390px, `isMobile`) + Android ОДНОВРЕМЕННО: пользователь на обеих поверхностях должен видеть один и тот же дизайн. Когда в задаче сказано «мобильный/mobile» — это всегда mobile web и Android вместе, не только одна из них.

- **Парная проверка обязательна.** Изменение mobile web проверяется тем же flow на локальной Android USB-сборке; изменение Android проверяется на mobile web. Расхождение исправляется в общем контракте. iOS-приложения пока нет: iOS не входит в QA, Done gate или `verify pending`.
- **Верификация UI-правок — на обеих платформах со скринами:** web-превью 390px (`preview_resize` + `preview_screenshot`) И устройство/эмулятор (`adb exec-out screencap -p`; dev-client сидит на том же Metro — HMR обновляет обе стороны).
- **Запрещены web-only визуальные ветвления в мобильном вьюпорте:** serif-шрифты и hover-only элементы — только desktop (`!isMobile`); контент-элементы (чипы, бейджи, кнопки) не скрывать через `Platform.OS === 'web'`, если на устройстве они видны.
- **Темизация:** для тематических поверхностей только `useThemedColors()` — `DESIGN_TOKENS.colors.*` на native это статичный светлый fallback, на web — живые CSS-переменные.
- **Попапы/карточки точек на картах** — один общий компонент на всех страницах и платформах (различия — только добавочный функционал), компактный, вся информация видна без обрезания по X и Y.
