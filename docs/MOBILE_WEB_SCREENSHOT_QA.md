# Mobile Web Screenshot QA

Сценарии автоматизированного ручного прогона mobile web со скриншотами по ключевым страницам.

## Цель

- За один прогон пройти public + auth страницы в мобильном viewport.
- Для каждой страницы получить:
  - full-page скриншот;
  - проверку отсутствия горизонтального overflow;
  - анализ console/page errors;
  - проверку, что страница действительно отрендерилась (signal check).

## Команда запуска

```bash
npx playwright test e2e/manual-qa-mobile-web-screenshots.spec.ts
```

## Что проверяется

### Public pages

- `/`
- `/travelsby` (или `E2E_TRAVELS_LIST_PATH`)
- `/search`
- `/map`
- `/roulette`
- `/quests`
- `/about`
- `/privacy`
- `/cookies`
- `/login`
- `/registration`

### Auth pages

- `/profile`
- `/favorites`
- `/history`
- `/messages`
- `/subscriptions`
- `/travel/new`
- `/userpoints`
- `/export`

## Критерии дефекта

- `navigation`: страница не открылась.
- `auth-redirect`: auth-страница редиректит на `/login`.
- `console-error`: есть `console.error`.
- `page-error`: есть `pageerror` (runtime exceptions).
- `horizontal-overflow`: есть горизонтальный скролл.
- `missing-signal`: не найден ни один ожидаемый UI-сигнал страницы.

## Артефакты

После запуска создается каталог:

`output/playwright/mobile-web-audit-<timestamp>/`

В нем:

- `report.json` — полный машинный отчет.
- `summary.md` — сводка по страницам и найденным проблемам.
- `public-*.png`, `auth-*.png` — скриншоты всех страниц.

## Поток работы

1. Запустить сценарий.
2. Прочитать `summary.md`.
3. Для каждой ошибки открыть соответствующий `*.png`.
4. Исправить дефект в коде.
5. Повторить запуск до нулевого количества issues.

