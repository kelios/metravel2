/**
 * Сигнал `#root[data-first-screen-ready]` — единственный носитель выигрыша #1405
 * (шелл снимался на 1,55 с позже готового первого экрана). Приёмную сторону
 * проверяет `__tests__/scripts/ssg-skeletons.test.ts`; здесь проверяется тот,
 * кто атрибут ставит.
 */
import { Platform } from 'react-native'

import {
  SSG_FIRST_SCREEN_READY_ATTR,
  markSsgFirstScreenReady,
} from '@/utils/ssgShellFirstScreen'

describe('markSsgFirstScreenReady', () => {
  let frames: Array<() => void>

  const flushFrame = () => {
    const queued = frames
    frames = []
    queued.forEach((cb) => cb())
  }

  const setPlatform = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true })
  }

  const originalOs = Platform.OS

  beforeEach(() => {
    frames = []
    document.body.innerHTML = '<div id="root"></div>'
    jest.spyOn(globalThis as any, 'requestAnimationFrame').mockImplementation(((cb: any) => {
      frames.push(() => cb(0))
      return frames.length
    }) as any)
    jest.spyOn(globalThis as any, 'cancelAnimationFrame').mockImplementation((() => {}) as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    document.body.innerHTML = ''
    Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
  })

  const root = () => document.getElementById('root') as HTMLElement

  it('ставит атрибут только после ДВУХ кадров — то есть после реальной отрисовки', () => {
    setPlatform('web')

    markSsgFirstScreenReady()
    expect(root().hasAttribute(SSG_FIRST_SCREEN_READY_ATTR)).toBe(false)

    flushFrame()
    expect(root().hasAttribute(SSG_FIRST_SCREEN_READY_ATTR)).toBe(false)

    flushFrame()
    expect(root().getAttribute(SSG_FIRST_SCREEN_READY_ATTR)).toBe('true')
  })

  it('cleanup снимает атрибут — экран, который ушёл, больше не отвечает за первый кадр', () => {
    setPlatform('web')

    const cleanup = markSsgFirstScreenReady()
    flushFrame()
    flushFrame()
    expect(root().getAttribute(SSG_FIRST_SCREEN_READY_ATTR)).toBe('true')

    cleanup()
    expect(root().hasAttribute(SSG_FIRST_SCREEN_READY_ATTR)).toBe(false)
  })

  it('cleanup до кадров отменяет сигнал — атрибут не появится вообще', () => {
    setPlatform('web')

    const cleanup = markSsgFirstScreenReady()
    cleanup()
    flushFrame()
    flushFrame()
    expect(root().hasAttribute(SSG_FIRST_SCREEN_READY_ATTR)).toBe(false)
  })

  it('без #root ничего не делает и не падает', () => {
    setPlatform('web')
    document.body.innerHTML = ''

    const cleanup = markSsgFirstScreenReady()
    flushFrame()
    flushFrame()
    expect(() => cleanup()).not.toThrow()
  })

  it('на native — no-op: SSG-шелла там нет', () => {
    setPlatform('android')

    const cleanup = markSsgFirstScreenReady()
    flushFrame()
    flushFrame()
    expect(root().hasAttribute(SSG_FIRST_SCREEN_READY_ATTR)).toBe(false)
    expect(() => cleanup()).not.toThrow()
  })
})
