# Локальный браузерный QA: экспериментальный исполнитель

Gemma сама составляет короткие сценарии и взаимодействует с настоящим браузером.
Один запуск — ограниченный гостевой batch. **Независимая приёмка обязательна**:
в пробах модель уже выдавала PASS за невыполненный переход и неполученную картинку.
Наличие браузера не делает её надёжным самостоятельным тестировщиком всего сайта.

Нормальный режим PhpStorm и его права не меняются. Этот CLI использует отдельный
профиль с браузером и чтением собственных артефактов. Канонический метод и формат
отчёта: [browser-qa.md](../../.codex/skills/metravel-local-apprentice/references/browser-qa.md).

## Зависимости этой машины

- Существующий OpenCode и локальная Gemma с mmproj на `127.0.0.1:18091`.
- Node 22: `/opt/homebrew/opt/node@22/bin/node`.
- Установленный проектный Playwright/Chromium: путь берётся из его API.
- Официальный Microsoft `@playwright/mcp` **0.0.86** в
  `~/metravel-ai/tools/playwright-mcp/` (внешняя зависимость, не пакет приложения).

Установка MCP, если его ещё нет, выполняется учителем из npm:

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm install \
  --prefix "$HOME/metravel-ai/tools/playwright-mcp" --save-exact @playwright/mcp@0.0.86
```

Runner проверяет эту версию, не обновляет зависимости, не скачивает браузер и не
запускает альтернативную модель автоматически. Нужный Gemma-сервис запускается
учителем последовательно с другими тяжёлыми моделями; недоступный backend даёт
явную ошибку без cloud fallback. Этот профиль не добавляет сервис в автозапуск.

## Один batch

Из корня MeTravel, при свободном quality gate:

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH node scripts/run-with-quality-gate-lock.js \
  local-browser-qa -- /Users/juliasavran/metravel-ai/tools/flux-mcp-venv/bin/python \
  .aiassistant/qa/run.py --viewport mobile --scope 'Гостевая навигация и поиск'
```

Затем отдельный контекст для desktop:

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH node scripts/run-with-quality-gate-lock.js \
  local-browser-qa -- /Users/juliasavran/metravel-ai/tools/flux-mcp-venv/bin/python \
  .aiassistant/qa/run.py --viewport desktop --scope 'Каталог и раскрытие фильтров'
```

`--prompt .codex-temp/my-qa/assignment.txt` добавляет UTF-8 назначение учителя
(до 16 KiB, без секретов). `--scope` — до 2000 символов. `--config-only` готовит
профиль без browser/model runtime и не требует quality wrapper. Действительный
QA-запуск проверяет, что его родитель владеет `local-browser-qa` lock.
Занятый wrapper печатает `SKIPPED`: не ждать, не повторять и не считать это PASS.
При таком пропуске нового QA receipt нет, даже если wrapper вернул код 0.

## Артефакты и границы

Каждый batch создаёт новый ignored `.codex-temp/local-web-qa/<UTC>-<id>/`:
назначение, точные конфиги, сырые JSONL-события, browser session, snapshots,
screenshots, console/network journal, финальный текст и `receipt.json`.

Receipt механически перечисляет реальные page URLs, вызовы и ошибки, длину,
остановку по бюджету, наличие финального JSON и существующих evidence файлов.
Это **не судья смысла**: корректность утверждений/UX и полноту сценария принимает
учитель. Сохранённый PNG и счётчик image/read событий ещё не доказывают доставку
изображения провайдеру; она отмечена как `not_verified_by_this_receipt`.

Каждый пункт имеет `kind: functional|visual`. Визуальный пункт с PASS/FAIL требует
PNG в `evidence_files` и успешный native Read того же файла с image attachment
в событии. Это связь артефакта с image-input событием, не доказательство wire
delivery. Схема/наличие URL всё равно не оценивают смысл действия за учителя.

- **0** — исполнитель завершился и структурный черновик готов к ревью; не PASS сайта.
- **2** — черновик неполон/не содержит проверяемого evidence.
- **124** — остановка по 24 шагам или 600 секундам; частичные артефакты сохранены.
- Другой ненулевой код — сбой runtime; данные для ревью сохраняются при запуске CLI.

После остановки даётся до 16 секунд на cleanup: pinned MCP закрывает собственный
Chromium по SIGTERM/SIGINT/закрытию stdin со своим 15-секундным exit watchdog.
Обычный coding runner сохраняет прежние лимиты и grace period.

Viewport фиксируется до запуска: mobile390×844 или настоящий desktop1440×900.
Нет shell/edit/Git/deploy/board, выполнения JS, подмены маршрутов, доступа к
cookies/storage и другим файлам. MCP workspace и screenshots ограничены дочерним
`browser/`, чтобы имя screenshot не затёрло конфиги/сырые события/receipt учителя.
Native Read проверяет realpath собственного batch и не следует symlink наружу.
Default browser guard блокирует non-GET/HEAD/OPTIONS и внешнюю top-level
навигацию; все top-level 3xx, включая внутренние canonical redirect, остаются
policy-blocked/NOT_TESTED. Обычные own-site 200/SPA переходы работают; service workers отключены.
Это рабочие ограничения гостевого QA, а не
общая защитная песочница. Ожидаемые policy-blocked запросы не являются багами.
Секреты/аккаунты в профиль не загружаются; journal удаляет query/fragment URL и
маскирует credential-подобные значения console, но не заменяет privacy review.

Лимит 24 шага механический, `read` до 160 строк и краткий план — инструкции,
не дополнительные hard limits. Авторизация, запись/удаление, другие роли,
AI/PDF и полный сайт не покрываются гостевым batch. По завершении сначала
сверить raw calls и материалы, затем решать о баг-репорте через Problem Memory.
