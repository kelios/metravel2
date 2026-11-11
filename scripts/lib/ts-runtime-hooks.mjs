/**
 * Перехватчики загрузки модулей для Node без встроенного снятия типов — ставит `ts-runtime.mjs`.
 * Работают в отдельном потоке загрузчика (`module.register`), поэтому зависимостей от скрипта нет.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { transformSync } from 'esbuild'

/** Только TypeScript проекта: пакеты из `node_modules` грузит Node без перехвата (как и его встроенное снятие типов). */
const isTypeScript = (url) => {
  if (!url.startsWith('file:')) return false
  const { pathname } = new URL(url)
  return pathname.endsWith('.ts') && !pathname.includes('/node_modules/')
}

/** Модуль приложения подключает соседа без расширения (`./generator`): Node такой адрес не находит. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    const relative = /^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)
    if (!relative || !isTypeScript(String(context.parentURL ?? ''))) throw error
    return nextResolve(`${specifier}.ts`, context)
  }
}

/** `.ts` → ES-модуль без типов; остальное грузит Node. */
export async function load(url, context, nextLoad) {
  if (!isTypeScript(url)) return nextLoad(url, context)
  const file = fileURLToPath(url)
  const { code } = transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'esm', target: 'esnext', sourcefile: file })
  return { format: 'module', source: code, shortCircuit: true }
}
