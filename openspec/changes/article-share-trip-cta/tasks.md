## 1. Контракты и вход из статьи

- [x] 1.1 Зафиксировать refined Task Contract, Problem History и Design evidence #2677; claim in_progress.
- [x] 1.2 Добавить bounded context helper и share-trip auth intent с regression tests всех auth round-trips.
- [x] 1.3 Встроить общий CTA для guest/reader кроме owner; сохранить save CTA и добавить impression/click.

## 2. Программная инициализация мастера

- [x] 2.1 Применить place/name и validated country как одноразовую pristine baseline, сохраняя recovery/edit/user input.
- [x] 2.2 Сохранить create href в auth-gate мастера и обеспечить первый шаг нового source flow.
- [x] 2.3 Показать редактируемый выбор страны на первом шаге только source flow и добавить контекст route_create_started.
- [x] 2.4 Добавить ключи RU/BE/UK/PL/EN и регрессию loading/error/invalid/draft/noautosave/analytics.

## 3. Source validation and review

- [x] 3.1 Выполнить релевантные Jest, type/lint, test:i18n, audit:prompts, strict OpenSpec; полный lint и необходимые guards.
- [ ] 3.2 Пройти независимый review-and-fix и code-review-gate; commit/push task paths main и testing с SHA.

## 4. Testing / acceptance

- [ ] 4.1 Обновить локальный backend перед первой тестовой сессией, выполнить production build/deploy через frontend-deployer с operation gate.
- [ ] 4.2 Проверить реальные guest/register/login и signed-in/owner flows, editable prefill и locales на 390/1440; screenshots/console/network, analytics payload без synthetic collect.
- [ ] 4.3 Выполнить auth round-trip e2e на dist и обязательные slider/slider-perf проверки; исправить выявленные дефекты через полный цикл.
- [ ] 4.4 Зафиксировать Done gate на борде, синхронизировать спецификацию и архивировать change.
