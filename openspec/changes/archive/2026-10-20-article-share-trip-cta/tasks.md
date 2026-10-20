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
- [x] 3.2 Пройти независимый review-and-fix и code-review-gate; commit/push task paths main и testing с SHA.

## 4. Testing / acceptance

- [x] 4.1 Обновить локальный backend перед первой тестовой сессией, выполнить production build/deploy через frontend-deployer с operation gate.
- [x] 4.2 Проверить реальные guest/register/login и signed-in/owner flows, editable prefill и locales на 390/1440; screenshots/console/network, analytics payload без synthetic collect.
- [x] 4.3 Зафиксировать исторические auth/slider результаты и приёмку владельцем: оставшийся финальный auth/slider-perf повтор отменён по прямому решению владельца 20.10.2026, не обозначен как выполненный PASS.
- [x] 4.4 Зафиксировать Done gate на борде, синхронизировать спецификацию и архивировать change.

## Итог приёмки — 20.10.2026

- Владелец прямо поручил считать #2677 проверенной и перевести в done. Борд подтверждает done от 2026-10-20T13:10:04Z; это основание закрытия оставшегося финального runtime-повтора.
- Production frontend: `7370daf7e99f3fb2da337cc8a1109333dda25332`, включая country-code исправление `3bb4616667931fbdb9aafc5a0b60cd991c9d90f5`. Deploy exit0, health/home/API200, точный SHA, post-deploy SEO31/0 ошибок/0 предупреждений.
- Исправление канонического нормализатора сохраняет валидный согласованный ISO2 как `country_code`; numeric country ID остаётся прежним. Реальный API→hook→prefill pipeline и ошибочные/неоднозначные варианты: 7 Jest-наборов/230 тестов PASS, scoped lint/full typecheck/pre-commit PASS; независимые review-and-fix и code-review-gate PASS.
- Исторические production-сценарии guest/register/login/reader/owner, 390/1440 и пять локалей и 37 slider/perf PASS подтверждены на исходной сборке. Исходные полные Jest имели fixture-падения, исправленные и повторённые целевыми наборами; полный exit0 не заявляется.
- Финальные auth-проверки на промежуточной сборке выявили ISO2-дефект и стали основанием исправления. Следующая попытка на финальной сборке остановилась до UI из-за сетевого TypeError локального API (причина не доказана); offline9 PASS. Raw FAIL сохранены.
- Повтор recheck3 НЕ ЗАПУСКАЛСЯ: владелец принял результат и отменил дальнейшие проверки. Нет новых auth/37perf/production-smoke PASS. Аккаунт104, cached preference и сущности не затронуты; собственные snapshot-server/watcher остановлены, backend не тронут.
- Evidence: `.codex-temp/2677/country-fix/`, `.codex-temp/2677/acceptance/`, `acceptance-final/`, `acceptance-recheck2/`, `acceptance-recheck3/owner-override-stop.json`.
- Прежний preview-дефект #2695 сохранён отдельно. Классификация, транспорт, consent и измерение #2659 не менялись.
