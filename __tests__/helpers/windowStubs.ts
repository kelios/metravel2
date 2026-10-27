/**
 * Стабы свойств настоящего jsdom-окна (#2735).
 *
 * С Jest 30 (jsdom 26) `window` на глобале — non-configurable accessor: `global.window = {...}`
 * больше не подменяет окно, а `Object.defineProperty(globalThis, 'window', …)` бросает
 * «Cannot redefine property». Тест подменяет только нужные свойства окна; `restoreWindowStubs()`
 * в `afterEach` возвращает исходные дескрипторы. Окружение без окна (SSR) — docblock
 * `@jest-environment node`, а не удаление `window`.
 */

type Restore = () => void

const restores: Restore[] = []

export function stubWindowProperty(key: string, value: unknown): void {
  const target = window as unknown as Record<string, unknown>
  const own = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, { configurable: true, enumerable: true, writable: true, value })
  restores.push(() => {
    if (own) Object.defineProperty(target, key, own)
    else delete target[key]
  })
}

export function stubWindowProperties(props: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(props)) stubWindowProperty(key, value)
}

export function restoreWindowStubs(): void {
  while (restores.length) restores.pop()!()
}
