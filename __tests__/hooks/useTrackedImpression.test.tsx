/**
 * Регрессия #1498: показ никогда не фиксировался.
 *
 * Наблюдатель ставился ref-колбэком в фазе коммита, а эффект, который должен
 * был лишь сбрасывать состояние при смене ключа, на первом же проходе рвал его
 * безусловно. Ref-колбэк после этого не вызывается, и взводить наблюдатель
 * заново было некому: за 30 дней ноль `quest_card_impression` при 26 кликах по
 * тем же карточкам и один-единственный `register_cta_impression`.
 */
import React from 'react'
import { Platform, View } from 'react-native'
import { render } from '@testing-library/react-native'

import { useTrackedImpression } from '@/hooks/useTrackedImpression'

type Entry = { isIntersecting: boolean; intersectionRatio: number }

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []

  observed: unknown[] = []
  disconnected = false

  constructor(private readonly callback: (entries: Entry[]) => void) {
    FakeIntersectionObserver.instances.push(this)
  }

  observe(node: unknown) {
    this.observed.push(node)
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true
  }

  takeRecords(): Entry[] {
    return []
  }

  enterViewport() {
    // Отключённый наблюдатель молчит — иначе тест не отличил бы живую подписку
    // от оборванной, а именно в этом и был дефект.
    if (this.disconnected) return
    this.callback([{ isIntersecting: true, intersectionRatio: 0.6 }])
  }
}

function Probe({ impressionKey, onImpression }: { impressionKey: string; onImpression: () => void }) {
  const impression = useTrackedImpression(impressionKey, onImpression)
  return <View testID="probe" ref={impression.ref as any} onLayout={impression.onLayout} />
}

const renderProbe = (props: { impressionKey: string; onImpression: () => void }) =>
  render(<Probe {...props} />)

const liveObserver = () => {
  const observer = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1]
  if (!observer) throw new Error('IntersectionObserver was never created')
  return observer
}

describe('useTrackedImpression', () => {
  const originalPlatform = Platform.OS
  const originalObserver = (globalThis as any).IntersectionObserver

  beforeEach(() => {
    ;(Platform as any).OS = 'web'
    ;(globalThis as any).IntersectionObserver = FakeIntersectionObserver
    FakeIntersectionObserver.instances = []
  })

  afterEach(() => {
    ;(Platform as any).OS = originalPlatform
    ;(globalThis as any).IntersectionObserver = originalObserver
  })

  it('keeps the observer alive after mount and reports the impression once', () => {
    const onImpression = jest.fn()
    renderProbe({ impressionKey: 'quest_card::7', onImpression })

    const observer = liveObserver()
    expect(observer.observed).toHaveLength(1)
    // Собственно регрессия: после монтирования наблюдатель обязан быть живым.
    expect(observer.disconnected).toBe(false)

    observer.enterViewport()
    observer.enterViewport()
    expect(onImpression).toHaveBeenCalledTimes(1)
  })

  it('re-arms for a new impression key on the same node', () => {
    const onImpression = jest.fn()
    const { rerender } = renderProbe({ impressionKey: 'quest_card::7', onImpression })

    liveObserver().enterViewport()
    expect(onImpression).toHaveBeenCalledTimes(1)

    rerender(<Probe impressionKey="quest_card::9" onImpression={onImpression} />)
    liveObserver().enterViewport()
    expect(onImpression).toHaveBeenCalledTimes(2)
  })

  it('stops observing when the element goes away', () => {
    const onImpression = jest.fn()
    const { unmount } = renderProbe({ impressionKey: 'quest_card::7', onImpression })
    const observer = liveObserver()

    unmount()

    expect(observer.disconnected).toBe(true)
    expect(onImpression).not.toHaveBeenCalled()
  })
})
