/**
 * Подменяет только `Date` (сегодняшний день кампании), оставляя таймеры и
 * планировщик React настоящими: с полностью фейковыми таймерами обновления
 * состояния после `fireEvent` не доезжают до дерева.
 */
export const fakeToday = (date: Date): void => {
  jest.useFakeTimers({
    now: date,
    doNotFake: [
      'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout',
    ],
  })
}
