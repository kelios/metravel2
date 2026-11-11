/**
 * Общий код приложения в Node-скриптах: модули `api/aiAssist/*.ts` грузит контур оценки ассистента
 * (`scripts/ai-assistant-eval/`), и считать ответ он обязан тем же кодом, что экран и служба (#3291).
 *
 * Подключается флагом `--import ./scripts/lib/ts-runtime.mjs` (он есть у команд `ai:assistant:*` в
 * `package.json` и у дочерних прогонов `accept.mjs`), поэтому руками флаги ставить не нужно:
 *   - Node со встроенным снятием типов (22.18+ либо `--experimental-strip-types`) — ничего не делает;
 *   - Node без него (объявленный проектом 22.13.1 и Node 20, который стоит по умолчанию на рабочей
 *     машине) — регистрирует загрузчик `ts-runtime-hooks.mjs`: типы снимает esbuild из зависимостей
 *     проекта, соседний модуль без расширения (`./generator`) находится как `.ts`.
 *
 * Метка в `globalThis` говорит остальным скриптам, каким способом TypeScript доступен: путь службы
 * (`ask-path.mjs`) с загрузчиком не ставит свой перехват адресов.
 */
import nodeModule from 'node:module'

export const TS_RUNTIME_MARK = Symbol.for('metravel.tsRuntime')

if (!globalThis[TS_RUNTIME_MARK]) {
  if (process.features?.typescript) {
    globalThis[TS_RUNTIME_MARK] = 'native'
  } else {
    if (typeof nodeModule.register !== 'function') {
      throw new Error(`нужен Node ≥ 20.6 (сейчас ${process.versions.node}): загрузчик TypeScript ставится через module.register`)
    }
    nodeModule.register('./ts-runtime-hooks.mjs', import.meta.url)
    globalThis[TS_RUNTIME_MARK] = 'hooks'
  }
}
