// #2119: окружение приложений для тестов `@jest-environment node`.
//
// Общий `__tests__/setup.ts` и в окружении `node` оставляет заглушки `document`
// и `Image`. В Hermes их нет вовсе — на время файла они убираются, чтобы тест
// ловил любое обращение к браузерным глобалам так же, как приложение:
// ReferenceError. `window` остаётся: в React Native это сам global, без `location`.
export const ABSENT_IN_HERMES = ['document', 'DOMParser', 'Node', 'HTMLElement', 'Image', 'localStorage'] as const

/** Вызывать на верхнем уровне файла теста: убирает глобалы в beforeAll и возвращает в afterAll. */
export function installHermesLikeGlobals(): void {
  const saved = new Map<string, PropertyDescriptor>()

  beforeAll(() => {
    for (const name of ABSENT_IN_HERMES) {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
      if (!descriptor) continue
      saved.set(name, descriptor)
      delete (globalThis as Record<string, unknown>)[name]
    }
  })

  afterAll(() => {
    for (const [name, descriptor] of saved) {
      Object.defineProperty(globalThis, name, descriptor)
    }
    saved.clear()
  })
}

export function expectHermesLikeGlobals(): void {
  for (const name of ABSENT_IN_HERMES) {
    expect(name in globalThis).toBe(false)
  }
  expect((globalThis as { window?: { location?: unknown } }).window?.location).toBeUndefined()
}
