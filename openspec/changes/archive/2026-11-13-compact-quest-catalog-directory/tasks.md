## 1. Компактный указатель

- [x] 1.1 Обернуть непустые группы в независимые нативные раскрывающиеся разделы, сохранив заголовки, ссылки и переносы.
- [x] 1.2 Добавить проверку серверной разметки закрытых разделов и сохранить прежние проверки состава/порядка ссылок; обновить feature contract.

## 2. Проверка и доставка

- [x] 2.1 Пройти целевые Jest/ESLint и независимое code-review-gate по полному diff.
- [x] 2.2 Коммит и push в main, переход задачи в testing, штатный выкат frontend.
- [x] 2.3 Проверить прод на mobile web 390 px, затем desktop 1980 px: закрытые/открытые разделы, клавиатура, работа без JS, ссылки, отсутствие горизонтального скролла и ошибок консоли.
- [x] 2.4 Зафиксировать evidence и Done gate, синхронизировать и архивировать OpenSpec change.

## Приёмка 13.11.2026

Production `77a9a9d5b8010476fd6c7c97f8d1bb5f208645bf`, canonical deploy 219 s, все bundle caps сохранены. После one-line reuse общего focus-owner: 3 Jest suites / 73 tests и независимый gate PASS. Mobile web 390×844 touch и desktop web 1980×990, JS/no-JS: три закрытых раздела, 132 px суммарно, каждый summary 44 px; independent tap/click/Enter/Space; computed focus 2 px / offset 2 px; 292 href совпадают с predeploy HTML, overflow и JS/console errors отсутствуют. EN no-JS: один раздел, 242 ссылки на EN.

Первый полный QA-command завершился rc1 после двух успешных JS-сценариев из-за HTTP504 документа в начале mobile no-JS. После подтверждённых GET `/quests` 200 / `/health` 200 выполнен один bounded remaining-only command (rc0, три оставшихся случая). Исходная ошибка сохранена, результаты JS переиспользованы при неизменном source SHA. Итоговый composed PASS: `.codex-temp/quests-catalog-fix/prod-return/acceptance-final.json`; исходные `acceptance-first-504.json/.log`; 8 screenshots. Причина разового 504 не установлена; UI-контракт после восстановления проверен полностью.
