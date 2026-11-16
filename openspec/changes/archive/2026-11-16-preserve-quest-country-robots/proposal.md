## Why

Карточка #3444: серверный robots страны квестов исчезает после гидрации, поскольку клиентский экран не объявляет вердикт. Цель: ровно один robots с тем же правилом индексируемости после загрузки и клиентского перехода.

## What Changes

- Экран страны передаёт вердикт существующего правила хаба общему SEO-владельцу.
- Регрессия проверяет настоящий Helmet, тонкий и наполненный хаб, переходы и сохранение build-owned noindex соседних страниц.
- История семейства дополняется подтверждённым механизмом и постоянным контролем.

## Capabilities

### New Capabilities

- `quest-country-robots`: сохранение вердикта индексируемости страны при гидрации и смене страницы.

### Modified Capabilities

Нет.

## Impact

- User-visible result: поисковик с JS получает тот же robots, что сервер.
- Platform impact: desktop web, mobile web; один DOM-контракт, без изменения вёрстки. Android/iOS не затронуты.
- Localization impact: none; правило не зависит от языка, новых текстов нет.
- Dependencies: нет; API/data, auth, analytics и security без изменений.
- SEO: только robots; URL, canonical, sitemap и JSON-LD сохраняются.
- Accessibility/performance: нет изменений UI, запросов и дополнительных эффектов.
- Fallback/mock policy: реальное правило каталога; тестовые данные допустимы только в unit-тестах.
- Existing behavior to preserve: города и детали сохраняют build-owned noindex, ошибки каталога и неизвестные адреса сохраняют свои экраны.
- Out of scope: порог хаба, контент, API, публикация данных квестов и native.
- Open questions: нет. Откат — revert task commit со штатным выкатом.
