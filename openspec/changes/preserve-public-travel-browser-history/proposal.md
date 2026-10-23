## Why

В #2703 настоящий переход 480→672 заменяет запись исходной статьи до browser Back. Читатель пропускает её и может покинуть сайт. Нужно восстановить обычную историю A→B→C с одним переходом на каждое действие Back/Forward.

## What Changes

- Исправить общий web navigation boundary публичных статей на закреплённой версии роутера, сохранив встроенный возврат и один документ.
- Закрепить причинный механизм unit/integration проверкой и реальным read-only production browser regression.
- Записать постоянный контроль семьи в Problem Memory.

## Capabilities

### New Capabilities

- `public-travel-browser-history`: история обычных переходов между публичными статьями и соседние контроли.

### Modified Capabilities

Нет существующей living spec для этого инварианта.

## Impact

- User-visible result: один Back возвращает к предыдущей статье, Forward восстанавливает следующую; не создаются фиктивные страницы.
- Platform impact: desktop web1440×900, mobile web390×844/touch/DPR3. Native-specific поведение не меняется; обязательна source-проверка Android/iOS ветки.
- Localization impact: none; новый текст/форматирование отсутствует, RU/BE/UK/PL/EN сохраняются.
- Dependencies: закреплённый expo-router57.0.28; backend dependencies и hard blockers отсутствуют.
- Fallback/mock policy: unit fixtures допустимы; browser acceptance использует реальные ссылки, native browser Back/Forward и реальные данные. Нельзя вставлять ссылки/router-команды, подделывать историю или заменять Back кнопкой.
- Data/API: прежние GET публичной статьи (`id:number`, `slug:string`, `name:string`, `description:string`, `meta_description:string|null`); writes=0.
- SEO: сохранить title/canonical/main, OG, Twitter description при смене статьи; тексты и renderer не меняются.
- Accessibility: сохранить anchors, keyboard/modifier/middle-click/new-tab semantics; layout/контраст/alt не меняются.
- Performance: SPA документ и timeOrigin сохраняются, нового media pipeline/размеров нет; history snapshots растут по числу переходов.
- Security: auth/права/секреты и URL allowlists не затронуты.
- Analytics: существующая смена маршрута сохраняется; новых событий/параметров нет.
- Existing behavior: каталог→деталь, прямой вход, повтор текущей цели, cross-tab переход, app Back и modifier links.
- Non-goals: #2702 editor double-pop, SEO-редактура #2658/#2700, native navigation, backend, редизайн, произвольное обновление зависимостей.
- Open questions: материальных продуктовых вопросов нет. Архитектурное сравнение вариантов фиксируется до apply в design.md.
