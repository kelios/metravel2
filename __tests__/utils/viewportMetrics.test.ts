/**
 * @jest-environment jsdom
 */

import {
  __resetViewportMetricsForTests,
  invalidateViewportSize,
  readViewportSize,
  readViewportWidth,
} from '@/utils/viewportMetrics'

type ViewportSpies = { width: jest.Mock<number, []>; height: jest.Mock<number, []> }

const installViewport = (width: number, height: number): ViewportSpies => {
  const widthSpy = jest.fn(() => width)
  const heightSpy = jest.fn(() => height)
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: widthSpy })
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: heightSpy })
  return { width: widthSpy, height: heightSpy }
}

describe('utils/viewportMetrics', () => {
  afterEach(() => {
    __resetViewportMetricsForTests()
  })

  it('reads the viewport once and serves later reads from cache', () => {
    const spies = installViewport(412, 915)

    expect(readViewportSize()).toEqual({ width: 412, height: 915 })
    expect(readViewportWidth()).toBe(412)
    expect(readViewportSize()).toEqual({ width: 412, height: 915 })

    // Ровно это и есть смысл модуля: `window.innerWidth` — forced layout, и три
    // читателя подряд не должны платить за три пересчёта раскладки.
    expect(spies.width).toHaveBeenCalledTimes(1)
    expect(spies.height).toHaveBeenCalledTimes(1)
  })

  it('re-reads after resize, because that is the only thing that changes the answer', () => {
    const first = installViewport(412, 915)
    expect(readViewportWidth()).toBe(412)
    expect(first.width).toHaveBeenCalledTimes(1)

    const second = installViewport(1280, 800)
    // Без события кэш обязан держаться: мутации DOM размер вьюпорта не меняют.
    expect(readViewportWidth()).toBe(412)
    expect(second.width).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('resize'))
    expect(readViewportWidth()).toBe(1280)
    expect(readViewportSize()).toEqual({ width: 1280, height: 800 })
  })

  it('re-reads after orientationchange', () => {
    installViewport(412, 915)
    expect(readViewportWidth()).toBe(412)

    installViewport(915, 412)
    window.dispatchEvent(new Event('orientationchange'))
    expect(readViewportSize()).toEqual({ width: 915, height: 412 })
  })

  it('subscribes to invalidation before the first read, so a later resize listener sees fresh values', () => {
    installViewport(412, 915)
    // Первое чтение вешает слушателя инвалидации.
    expect(readViewportWidth()).toBe(412)

    // Прикладной слушатель регистрируется ПОСЛЕ — как в `Header`
    // (`app/(tabs)/_layout.tsx`) и в сторе `useResponsive`. При одинаковой цели
    // обработчики идут в порядке регистрации, значит кэш к этому моменту сброшен.
    const seen: (number | null)[] = []
    const consumer = () => seen.push(readViewportWidth())
    window.addEventListener('resize', consumer)

    installViewport(320, 640)
    window.dispatchEvent(new Event('resize'))
    window.removeEventListener('resize', consumer)

    expect(seen).toEqual([320])
  })

  it('treats an unusable reading as "no viewport" instead of caching garbage', () => {
    installViewport(0, 0)
    expect(readViewportSize()).toBeNull()
    expect(readViewportWidth()).toBeNull()

    installViewport(Number.NaN, Number.NaN)
    invalidateViewportSize()
    expect(readViewportSize()).toBeNull()

    // Непригодное чтение не оседает в кэше — следующий валидный замер проходит.
    installViewport(768, 1024)
    invalidateViewportSize()
    expect(readViewportSize()).toEqual({ width: 768, height: 1024 })
  })
})
