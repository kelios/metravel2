## Context and source evidence

#2677; нормативный макет: `docs/design/travel-article-share-trip-2677.md`. Анализ распределён между task-author, travel-expert/designer, системным архитектором и независимым review-auditor до apply.

- `TravelDetailsContentSection.tsx:143` содержит прежний гостевой CTA перед текстом. Рядом монтируется один общий CTA; favorite и hero не затрагиваются.
- `authNavigation.ts` уже нормализует внутренние redirect и сохраняет query; намерение share-trip не должно подменять полный redirect голым маршрутом.
- Email-регистрация не авторизует (`RegistrationForm.tsx:135–151`); существующий `AuthRequiredState` в `UpsertTravelView.tsx:355/366` теряет query. Все его auth links используют построенный create href.
- В `TravelFormData` нет `place`/source ID; `TravelWizardStepBasic` содержит name/description, страны редактируются позже. Имя места становится исходным `name`; существующий `MultiSelectField` даёт редактируемую страну на первом шаге этого сценария.
- Обычный `setFormData` отмечает пользовательское изменение (`useTravelFormData.ts:360`). Программный seed выполняется через первоначальную pristine baseline до autosave, с синхронизацией form refs; recovered draft имеет приоритет.

## Decision and boundaries

Выбран единый ограниченный navigation-context helper и одноразовая инициализация формы. Отвергнуты копирование заголовка/текста/маршрута исходной статьи, новое backend поле места и эффект с пользовательским setter: они нарушают собственное авторство, API или вызывают сохранение без действия.

Navigation context: `/travel/new?source_travel_id=<positive integer>&country=<positive ID or ISO2>&place=<bounded name>`. Place берётся из cityName, затем первого непустого имени travelAddress; Страна извлекается из доступного country ID либо `countryCode`; перед выбором в форме выполняется точное однозначное сопоставление текущему словарю country_id. ID/строки нормализованы и ограничены. Ничего из этого не добавляется в backend payload. Отсутствующие значения не выдумываются; неизвестная страна не выбирается. `mode=note` исключён, пока #2666 todo.

Share intent фиксируется для текущего нового flow, чтобы locale/filter refresh и приход другого query поверх смонтированной редактируемой формы не повторяли seed. Первичная загрузка ждёт завершения каталога success/error, затем name/countries входят в baseline без hasUserInteracted. Recovery и существующая статья не сбрасываются; новый source flow открывает шаг 1, а не сохранённый общий `_new` step.

UI owner: CTA, его mount, optional first-step country control и props в WizardStepRouter. Data owner: helper, auth intent, form lifecycle, controller/view, funnel context. Root: локали, durable design, OpenSpec. Существующие MultiSelectField/Button/theme используются без новых primitives.

## Auth, analytics and security

Auth redirect ограничен существующим normalizeInternalAuthRedirect; каждый round-trip сохраняет канонический create href. Нормализация не ослабляет защиту внешних redirect и других intent.

`content_create_cta_click`: source `travel_article`; `route_create_started`: source `travel_article_cta`, строковый `source_travel_id`. GA автоматически получает `ui_source` через существующий mapper; transport/classifier/consent и #2659 не меняются. Показ по существующему impression-pattern, один раз для видимого CTA. Тестовые collect в QA перехватываются до счётчиков, payload сверяется без загрязнения замера.

## Other impacts

- SEO: публичные URL/metadata не меняются; существующая закрытая create page.
- Accessibility: полная подпись, visible focus, keyboard activation, ≥44px, перенос текста и общая mobile parity.
- Performance: нет новых media/API requests для CTA; каталог стран уже используется мастером. Hero/slider не меняется; travel-details path требует slider/slider-perf guards в testing.
- Migration: не нужна; backend schema без изменений. Откат — revert task commits, совместимость старых create/auth URL сохраняется.
- Native: общие компоненты/Expo Router, без новых platform files/config/APIs. Device gate только при выявленном target-specific изменении.

## Validation matrix

- Static/unit: bounded URLs/invalid params, auth share-trip и nested query, CTA guest/reader/owner/unresolved, first-step editable country/place, async catalog, recovery/baseline/noautosave, обычный create/edit, reserved parameter boundary.
- `npm run test:i18n`, scoped type/lint, обязательный `npm run lint`; full Jest при крупном итоговом diff. Полный task diff: review-auditor → code-review-gate → explicit paths commit/push main.
- После testing/deploy: проверить `.build-source.json`, guest registration→login return и auth directflow, owner suppression, edit values, no copied content; screenshots/console/network 390/1440, все пять локалей.
- Regression e2e на production dist после review: nested auth return, no source content copying, unchanged save CTA, slider и slider-perf. Нет API mocks в обязательной прод-пробе.

## Уточнение границы стран и закрытие

Финальный auth e2e установил потерю optional country_code в каноническом API-нормализаторе до hook/prefill. Исправление сохраняет только валидный согласованный ISO2, не угадывает страну по названию и не меняет обязательные ID/title. Кэш стран хранится только в памяти страницы, поэтому миграция/сброс пользовательских данных не нужны. Регрессия проходит реальный fetchAllCountries → API-нормализацию → hook → разрешение начальных значений. Missing/invalid/conflicting/duplicate ISO2 оставляет выбор пустым; numeric ID остаётся рабочим.

20.10.2026 владелец принял задачу и отменил оставшийся финальный runtime-повтор. Состояние done фиксирует это решение, выполненные source/deploy-проверки и сохранённые фактические результаты; невыполненные проверки не объявлены успешными. Исходный сетевой TypeError pre-UI не признан продуктовым дефектом без доказанной причины.
