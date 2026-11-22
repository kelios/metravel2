#!/usr/bin/env node
/**
 * Контур оценки ассистента /assistant (#2710): вопросы посетителя уходят в службу `/ai/ask` тем же
 * клиентом, что у экрана (`ask-path.mjs`), — подбор по индексу, подсказка, модель и стражи работают
 * без подмен. Путь один (#3286, #3297); Playwright и Metro не нужны.
 *
 *   npm run ai:assistant:eval                         # все вопросы, служба :8787
 *   npm run ai:assistant:eval -- --group off_topic --label v2
 *   npm run ai:assistant:eval -- --ask-url http://127.0.0.1:8788 --model-url http://127.0.0.1:8090 --label v3
 *   npm run ai:assistant:eval -- --cases scripts/ai-assistant-eval/cases.live.jsonl --repeat 3
 *   npm run ai:assistant:eval -- --report <папка>     # пересчитать проверки и отчёт (+ judge.jsonl судьи)
 *   npm run ai:assistant:eval -- --report <папка> --out <другая папка>   # то же копией: исходный прогон не меняется
 *
 * Служба запущена с `AI_ASSIST_EVAL_TRACE=1` (иначе прогон откажет до первого вопроса); `--model-url` —
 * сверка, что служба смотрит на эту модель. `--provider ask` принимается ради старых команд.
 *
 * Нужен локальный стек: прокси прод-API, `llama-server` и служба
 * (`docs/features/ai-assistant.md` → «Локальный стек для проверки», «Контур оценки»). Результат — в
 * `.codex-temp/ai-assistant-eval/<время>[-метка]/`: `results.jsonl`, `report.md`,
 * `judge-task.md` (задание судье-агенту).
 *
 * Этот файл — только точка входа (#3345). Прогон (`run-core.mjs`) грузит общий код приложения на
 * TypeScript, а Node до 22.18 без загрузчика `scripts/lib/ts-runtime.mjs` падал на первом же импорте
 * с `ERR_UNKNOWN_FILE_EXTENSION` — раньше, чем скрипт успевал что-либо сказать. Загрузчик
 * подключается здесь, до импорта прогона: прямой `node scripts/ai-assistant-eval/run.mjs` работает
 * так же, как `npm run ai:assistant:eval`; на Node старше 20.6 загрузчик сам называет нужную версию.
 */
await import('../lib/ts-runtime.mjs')
const { main } = await import('./run-core.mjs')
await main(process.argv.slice(2))
