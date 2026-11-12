#!/usr/bin/env node
/**
 * Контур оценки ассистента /assistant (#2710): вопросы посетителя задаются через
 * тот же экран, что у человека, — подбор `api/aiAssist/retrieval.ts` → промпт
 * `prompt.ts` → `llama-server` → страж `linkGuard.ts` работают без подмен.
 * Playwright перехватывает только запрос к модели: пересылает его в `--model-url`
 * и сохраняет карточки промпта и сырой ответ до стража.
 *
 *   npm run ai:assistant:eval                         # все вопросы, модель :8080, экран :8081
 *   npm run ai:assistant:eval -- --group off_topic --label v2
 *   npm run ai:assistant:eval -- --model-url http://127.0.0.1:8090 --label v3
 *   npm run ai:assistant:eval -- --base http://localhost:8085 --tree .codex-temp/wt-eval-base --label before
 *   npm run ai:assistant:eval -- --report <папка>     # пересчитать проверки и отчёт (+ judge.jsonl судьи)
 *   npm run ai:assistant:eval -- --report <папка> --out <другая папка>   # то же копией: исходный прогон не меняется
 *   npm run ai:assistant:eval -- --provider ask --ask-url http://127.0.0.1:8787 --cases scripts/ai-assistant-eval/cases.live.jsonl
 *
 * `--provider ask` (#3286) — путь службы `/ai/ask`, который получит посетитель на проде: вопрос
 * уходит в службу клиентом экрана, Playwright и Metro не нужны (`ask-path.mjs`). Служба запущена с
 * `AI_ASSIST_EVAL_TRACE=1`; `--model-url` здесь — сверка, что служба смотрит на эту модель.
 *
 * Нужен локальный стек: прокси прод-API, `llama-server`, Metro с ассистентом
 * (`docs/features/ai-assistant.md` → «Контур оценки»). Результат — в
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
