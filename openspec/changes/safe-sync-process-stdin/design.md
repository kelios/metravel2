## Context

См. proposal.md. Два вида потребителей: spawnSync возвращает status/stdout/stderr/error; execFileSync возвращает stdout и бросает исключение при ошибке. Это поведение должно сохраниться.

## Goals / Non-Goals

Goals: один жизненный цикл файлового stdin для обоих Node API, включая пустой ввод и исключения при подготовке файла.
Non-Goals: смена API отчётов, асинхронный запуск, общий принудительный timeout всех процессов.

## Decisions

- scripts/lib/runSyncWithStdin.js экспортирует spawnSyncWithStdin и execFileSyncWithStdin; общая приватная функция готовит options. При input === undefined исходный stdio сохраняется. Иначе input исключается из options, записывается в приватный временный каталог и открытый fd заменяет только stdin. stdout/stderr, encoding, cwd, env, maxBuffer, timeout и ошибки исходного Node API сохраняются.
- У execFileSync с незаданным stdio есть автоматическая печать stderr. Для этой ветки общий spawn adapter возвращает captured stderr, helper печатает его и сохраняет стандартные поля sync exec ошибки; при explicit stdio и без input вызывается исходный execFileSync. Регрессия проверяет success stderr и nonzero status/stdout/stderr/message.
- try/finally охватывает запись, открытие и запуск; fd закрывается и каталог удаляется при успехе, nonzero, ENOENT, timeout и исключении подготовки.
- git check-ignore получает timeout 20 секунд и SIGKILL; допустимы только статусы 0/1, остальные ошибки не превращаются в пустой список игнорирования.
- Policy-тест разбирает AST всех scripts/**/*.{js,cjs,mjs,ts}, ищет input (включая shorthand) в options прямых синхронных запусков. Строки и комментарии не считаются вызовами. Проверяются aliases child_process и локально объявленные options.
- Альтернативы: только timeout оставляет проблемный pipe; копии файлового ввода в каждом скрипте дублируют cleanup; асинхронная миграция меняет контракты потребителей без необходимости.

## Risks / Trade-offs

- [Файловый ввод меняет isTTY/fstat] → потребители уже ожидают перенаправленный stdin; runCli использовал файл до задачи.
- [Искажение ошибок/вывода] → реальные процессы проверяют обе оболочки, бинарные байты, encoding, stdio и cleanup.
- [Новый вызов в обход helper] → policy-тест всего scripts/** и его отрицательные фикстуры.
- [Временный файл при SIGKILL родителя] → штатный finally чистит нормальные исходы; аварийная остановка самого Node остаётся пределом механизма.

## Migration Plan

Перевести все шесть найденных потребителей и тестовый runCli одним коммитом. Unit/policy и существующие тесты, независимое review-auditor и code-review-gate, push main, testing, стресс 8×150 на macOS. Web-деплой не нужен: этот код не входит в web/app bundle. Откат — revert коммита задачи. API/data не меняются.
