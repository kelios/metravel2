/** #2198: actual wizard composition and transient state across resize. */
import React, { useEffect, useState } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react-native'
import { Keyboard, Platform, ScrollView, Text, TextInput, Pressable, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReactTestInstance } from 'react-test-renderer'

let mockViewport = { width: 390, height: 844 }
const mockViewportListeners = new Set<() => void>()
let mockLocale = 'pl'
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => {
    const React = require('react')
    const viewport = React.useSyncExternalStore(
      (listener: () => void) => { mockViewportListeners.add(listener); return () => mockViewportListeners.delete(listener) },
      () => mockViewport,
    )
    return {
      ...viewport,
      isPhone: viewport.width < 480,
      isLargePhone: viewport.width >= 480 && viewport.width < 768,
      isMobile: viewport.width < 768,
      isHydrated: true,
    }
  },
}))
jest.mock('@/hooks/useQuestContentLocale', () => ({ useQuestContentLocale: () => mockLocale }))
jest.mock('expo-router', () => ({
  usePathname: () => '/quests/test/test',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react')
    React.useEffect(() => callback(), [callback])
  },
}))
jest.mock('@/hooks/useBreadcrumbModel', () => ({
  useBreadcrumbModel: () => ({
    showBreadcrumbs: true, pageContextTitle: 'Квест', currentTitle: 'Квест', backToPath: null,
    items: [{ label: 'Квест', path: '/quests' }],
  }),
}))
// Unrelated network/media sections follow the nearest guest-wizard harness.
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsSidebar: () => null,
  QuestFinalePanel: () => null,
}))
jest.mock('@/components/quests/useQuestFinaleMedia', () => ({
  useQuestFinaleMedia: () => ({ frameW: 300, videoOk: true }),
}))
jest.mock('@/components/quests/useQuestReminder', () => ({ useQuestReminder: () => undefined }))
jest.mock('@/components/quests/QuestPrintable', () => ({ generatePrintableQuest: jest.fn() }))
jest.mock('@/components/quests/questOfflineMapExport', () => ({
  exportQuestOfflineMap: jest.fn(), getQuestOfflineMapPoints: () => [], openQuestOfflineMapInApp: jest.fn(),
}))
jest.mock('@/utils/analytics', () => ({ queueAnalyticsEvent: jest.fn() }))
jest.mock('@/utils/questAnswerTelemetry', () => ({
  recordQuestAnswerAttempt: jest.fn(), flushQuestAnswerAttempts: jest.fn(),
}))

import { QuestWizard } from '@/components/quests/QuestWizard'
import QuestContentLocaleNotice from '@/components/quests/QuestContentLocaleNotice'
import { getLocaleDisplayName } from '@/i18n/localeLabels'
import HeaderContextBar from '@/components/layout/HeaderContextBar'
import { resetScreenHeaderForTests } from '@/components/layout/ScreenHeaderContext'

const steps = ['p1', 'p2', 'p3'].map((id, index) => ({
  id, title: `Точка ${index + 1}`, location: '', story: `Story ${id}`, task: `Task ${id}`,
  lat: 53.9, lng: 27.56, answer: (value: string) => value === 'correct',
}))
const finale = { story: 'Финал' }

function isDescendant(node: ReactTestInstance, ancestor: ReactTestInstance): boolean {
  let parent = node.parent
  while (parent) {
    if (parent === ancestor) return true
    parent = parent.parent
  }
  return false
}

type WizardView = ReturnType<typeof render>
type AnchorMeasureCallback = (x: number, y: number, width: number, height: number) => void
const contentScroll = (view: WizardView) => view.UNSAFE_getAllByType(ScrollView)
  .find((scroll) => scroll.props.keyboardShouldPersistTaps === 'handled')!
const routeInContent = (view: WizardView) => isDescendant(view.getByTestId('quest-route-strip'), contentScroll(view))

describe('QuestWizard short viewport (#2198)', () => {
  const originalOS = Platform.OS
  let mounts: number
  let unmounts: number
  let routeFocus: jest.Mock

  function ReadingState() {
    const [count, setCount] = useState(0)
    useEffect(() => {
      mounts += 1
      return () => { unmounts += 1 }
    }, [])
    return <Pressable testID="reading-state" onPress={() => setCount((value) => value + 1)}><Text>{count}</Text></Pressable>
  }

  async function setup(width = 390, height = 844, statusSlot?: React.ReactNode, globalHeader = false) {
    mockViewport = { width, height }
    const node = (
      <QuestWizard
        title="Тест-квест" steps={steps} finale={finale} storageKey="short_viewport_2198"
        contentLocaleSlot={<QuestContentLocaleNotice contentLocale="ru" compact />}
        statusSlot={statusSlot} subscribeSlot={<ReadingState />}
      />
    )
    const renderNode = () => globalHeader
      ? <><HeaderContextBar />{React.cloneElement(node)}</>
      : React.cloneElement(node)
    let view: WizardView | undefined
    let anchorMeasure: ((callback: AnchorMeasureCallback, y: number) => void) | undefined
    // RN's Jest View ref is the component instance, whose native measurement
    // methods do not call back. Host createNodeMock does not replace that ref.
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (this: { props: { testID?: string } }, callback) {
      if (this.props.testID === 'quest-main-content-anchor') {
        const strip = view?.queryByTestId('quest-route-strip')
        const y = view && strip && isDescendant(strip, contentScroll(view)) ? 98 : 122
        if (anchorMeasure) anchorMeasure(callback, y)
        else callback(0, y, mockViewport.width, 500)
      }
    })
    jest.spyOn(View.prototype, 'focus').mockImplementation(function (this: { props: { testID?: string; accessibilityState?: { selected?: boolean } } }) {
      if (this.props.testID === 'quest-route-strip') routeFocus('route')
      else if (this.props.accessibilityState?.selected) routeFocus('current')
    })
    view = render(renderNode())
    await act(async () => { await Promise.resolve() })
    return {
      view,
      setAnchorMeasure: (measure: (callback: AnchorMeasureCallback, y: number) => void) => { anchorMeasure = measure },
      resize: async (nextWidth: number, nextHeight: number) => {
        mockViewport = { width: nextWidth, height: nextHeight }
        // Notify memoized consumers through the same external-store contract
        // as useResponsive; retain component and slot identities across renders.
        await act(async () => {
          mockViewportListeners.forEach((listener) => listener())
          view!.rerender(renderNode())
          await Promise.resolve()
        })
      },
    }
  }

  beforeEach(async () => {
    Platform.OS = 'web'
    mockLocale = 'pl'
    mounts = 0
    unmounts = 0
    routeFocus = jest.fn()
    resetScreenHeaderForTests()
    await AsyncStorage.clear()
    window.localStorage.clear()
  })
  afterEach(() => { cleanup(); jest.restoreAllMocks(); Platform.OS = originalOS })

  it.each([[320, 640, true], [390, 640, true], [390, 839, true], [390, 840, false], [390, 844, false], [599, 640, true]] as const)(
    '%dx%d has one route in the expected reading surface', async (width, height, flow) => {
      const { view } = await setup(width, height)
      expect(view.getAllByTestId('quest-route-strip')).toHaveLength(1)
      expect(view.UNSAFE_getAllByType(ScrollView).filter((scroll) => scroll.props.keyboardShouldPersistTaps === 'handled')).toHaveLength(1)
      expect(routeInContent(view)).toBe(flow)
      expect(view.UNSAFE_getAllByType(TextInput)).toHaveLength(1)
    },
  )

  it('relocates only the header; existing input, reading state and scroll host survive', async () => {
    const { view, resize } = await setup()
    const scroll = contentScroll(view)
    const input = view.UNSAFE_getByType(TextInput)
    fireEvent.changeText(input, 'my unsent answer')
    fireEvent.press(view.getByTestId('reading-state'))
    await resize(390, 640)
    expect(routeInContent(view)).toBe(true)
    expect(contentScroll(view) === scroll).toBe(true)
    expect(view.UNSAFE_getByType(TextInput) === input).toBe(true)
    expect(view.UNSAFE_getByType(TextInput).props.value).toBe('my unsent answer')
    expect(view.getByTestId('reading-state').findByType(Text).props.children).toBe(1)
    expect([mounts, unmounts]).toEqual([1, 0])
    await resize(390, 844)
    expect(routeInContent(view)).toBe(false)
    expect(contentScroll(view) === scroll).toBe(true)
    expect(view.UNSAFE_getByType(TextInput).props.value).toBe('my unsent answer')
    expect([mounts, unmounts]).toEqual([1, 0])
  })

  it('keeps an open route sheet and current row across height and 599/600 changes', async () => {
    const { view, resize } = await setup()
    fireEvent.press(view.getByTestId('quest-route-strip'))
    const sheet = view.getByTestId('quest-route-sheet')
    const current = view.getByTestId('quest-route-row-p1')
    expect(current.props.accessibilityState.selected).toBe(true)
    await resize(599, 640)
    await resize(600, 640)
    await resize(390, 640)
    expect(view.getByTestId('quest-route-sheet') === sheet).toBe(true)
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
    expect(routeInContent(view)).toBe(false)
    fireEvent.press(view.getByRole('button', { name: 'Закрыть' }))
    await act(async () => { await Promise.resolve() })
    expect(view.queryByTestId('quest-route-sheet')).toBeNull()
    expect(routeInContent(view)).toBe(true)
    expect(routeFocus).toHaveBeenCalled()
  })

  it('applies the latest desired mode only after answering ends, with the answer intact', async () => {
    const { view, resize } = await setup()
    const input = view.UNSAFE_getByType(TextInput)
    fireEvent(input, 'focus')
    fireEvent.changeText(input, 'unfinished answer')
    await resize(390, 640)
    expect(routeInContent(view)).toBe(false)
    await resize(600, 640)
    await resize(390, 844)
    fireEvent(input, 'blur')
    await act(async () => { await Promise.resolve() })
    expect(routeInContent(view)).toBe(false)
    expect(view.UNSAFE_getByType(TextInput) === input).toBe(true)
    expect(input.props.value).toBe('unfinished answer')
    fireEvent(input, 'focus')
    await resize(390, 640)
    fireEvent(input, 'blur')
    await act(async () => { await Promise.resolve() })
    expect(routeInContent(view)).toBe(true)
    expect(view.UNSAFE_getByType(TextInput).props.value).toBe('unfinished answer')
  })

  it('closing after 599→600 restores focus to the live current-point navigation', async () => {
    const { view, resize } = await setup(599, 640)
    fireEvent.press(view.getByTestId('quest-route-strip'))
    await resize(600, 640)
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
    fireEvent.press(view.getByRole('button', { name: 'Закрыть' }))
    await act(async () => { await Promise.resolve() })
    expect(view.queryByTestId('quest-route-strip')).toBeNull()
    expect(view.queryByTestId('quest-route-sheet')).toBeNull()
    // Shared Jest's Pressable supplies aria-selected as a string; RNTL's
    // selected filter prioritizes it over the boolean native state.
    expect(view.getByRole('button', { name: /^Точка 1:/ }).props.accessibilityState.selected).toBe(true)
    expect(routeFocus).toHaveBeenLastCalledWith('current')
  })

  it('defers during scrolling and compensates the reading anchor instead of resetting the step', async () => {
    jest.useFakeTimers()
    try {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined)
      const dismiss = jest.spyOn(Keyboard, 'dismiss')
      const { view, resize } = await setup()
      // Modern fake timers schedule requestAnimationFrame on 16 ms frames.
      await act(async () => { await jest.advanceTimersByTimeAsync(20) })
      scrollTo.mockClear()
      const scroll = contentScroll(view)
      fireEvent(scroll, 'scrollBeginDrag')
      expect(dismiss).toHaveBeenCalledTimes(1)
      fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 200, x: 0 } } })
      await resize(390, 640)
      expect(routeInContent(view)).toBe(false)
      fireEvent(scroll, 'scrollEndDrag')
      await act(async () => { await jest.advanceTimersByTimeAsync(200) })
      expect(routeInContent(view)).toBe(true)
      expect(scrollTo).toHaveBeenCalledWith({ y: 176, animated: false })
      expect(scrollTo.mock.calls.some(([options]) => options?.y === 0)).toBe(false)
      expect(contentScroll(view) === scroll).toBe(true)
      expect([mounts, unmounts]).toEqual([1, 0])
    } finally { jest.useRealTimers() }
  })

  it.each(['touchEnd', 'touchCancel'] as const)('keeps a paused web touch busy until %s', async (release) => {
    jest.useFakeTimers()
    try {
      const { view, resize } = await setup()
      const scroll = contentScroll(view)
      fireEvent(scroll, 'touchStart')
      fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 200, x: 0 } } })
      await act(async () => { await jest.advanceTimersByTimeAsync(300) })
      await resize(390, 640)
      expect(routeInContent(view)).toBe(false)
      await act(async () => { await jest.advanceTimersByTimeAsync(300) })
      expect(routeInContent(view)).toBe(false)
      fireEvent(scroll, release)
      await act(async () => { await jest.advanceTimersByTimeAsync(200) })
      expect(routeInContent(view)).toBe(true)
      expect(contentScroll(view) === scroll).toBe(true)
      expect([mounts, unmounts]).toEqual([1, 0])
    } finally { jest.useRealTimers() }
  })

  it('keeps an orientation-resized route sheet while live screen actions have one owner', async () => {
    const { view, resize } = await setup(390, 640, undefined, true)
    fireEvent.press(view.getByTestId('quest-route-strip'))
    const sheet = view.getByTestId('quest-route-sheet')
    const input = view.UNSAFE_getByType(TextInput)
    fireEvent.changeText(input, 'orientation answer')
    for (const width of [767, 768, 844, 767, 390]) {
      await resize(width, 640)
      expect(view.getByTestId('quest-route-sheet') === sheet).toBe(true)
      expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
      expect(view.UNSAFE_getByType(TextInput) === input).toBe(true)
      expect(input.props.value).toBe('orientation answer')
      const mobileActions = view.queryAllByTestId('screen-header-more').length
      const panelActions = view.queryAllByTestId('quest-header-actions').length
      expect([mobileActions, panelActions]).toEqual(width < 768 ? [1, 0] : [0, 1])
      expect(routeInContent(view)).toBe(true)
    }
  })

  it('keyboard overlap alone defers relocation after input blur, without treating it as layout height', async () => {
    class VisualViewportFixture extends EventTarget {
      height = 844
      offsetTop = 0
      resizeTo(height: number) { this.height = height; this.dispatchEvent(new Event('resize')) }
    }
    const viewport = new VisualViewportFixture()
    const previousViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const previousHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
    jest.useFakeTimers()
    try {
      const { view, resize } = await setup(390, 640)
      const scroll = contentScroll(view)
      const input = view.UNSAFE_getByType(TextInput)
      fireEvent(input, 'focus')
      fireEvent.changeText(input, 'keyboard answer')
      await act(async () => { viewport.resizeTo(512); await jest.advanceTimersByTimeAsync(20) })
      fireEvent(input, 'blur')
      await resize(390, 844)
      expect(routeInContent(view)).toBe(true)
      expect(input.props.value).toBe('keyboard answer')
      await act(async () => { viewport.resizeTo(844); await jest.advanceTimersByTimeAsync(200) })
      expect(routeInContent(view)).toBe(false)
      expect(view.UNSAFE_getByType(TextInput) === input).toBe(true)
      expect(contentScroll(view) === scroll).toBe(true)
      expect([mounts, unmounts]).toEqual([1, 0])
    } finally {
      cleanup()
      jest.useRealTimers()
      if (previousViewport) Object.defineProperty(window, 'visualViewport', previousViewport)
      else Reflect.deleteProperty(window, 'visualViewport')
      if (previousHeight) Object.defineProperty(window, 'innerHeight', previousHeight)
      else Reflect.deleteProperty(window, 'innerHeight')
    }
  })

  it('reads saved offline progress and preserves its answer/current point across resize', async () => {
    await AsyncStorage.setItem('short_viewport_2198', JSON.stringify({
      index: 1, unlocked: 1, answers: { p1: 'correct' }, attempts: {}, hints: {}, showMap: false,
    }))
    const { view, resize } = await setup()
    const input = view.UNSAFE_getByType(TextInput)
    fireEvent.changeText(input, 'offline draft')
    ;(AsyncStorage.setItem as jest.Mock).mockClear()
    await resize(390, 640)
    expect(view.UNSAFE_getByType(TextInput) === input).toBe(true)
    expect(input.props.value).toBe('offline draft')
    expect(view.getByTestId('quest-content-locale-notice')).toBeTruthy()
    fireEvent.press(view.getByTestId('quest-route-strip'))
    expect(view.getByTestId('quest-route-row-p2').props.accessibilityState.selected).toBe(true)
    expect(view.getByLabelText(/Точка 1.*пройдена/)).toBeTruthy()
    expect(AsyncStorage.setItem).not.toHaveBeenCalled()
    const saved = JSON.parse((await AsyncStorage.getItem('short_viewport_2198'))!)
    expect(saved.answers).toEqual({ p1: 'correct' })
    expect(saved.index).toBe(1)
  })

  it('an intentional point change cancels an outstanding layout anchor before resetting the new point', async () => {
    await AsyncStorage.setItem('short_viewport_2198', JSON.stringify({
      index: 0, unlocked: 1, answers: { p1: 'correct' }, attempts: {}, hints: {}, showMap: false,
    }))
    jest.useFakeTimers()
    try {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined)
      const { view, resize, setAnchorMeasure } = await setup(390, 640)
      await act(async () => { await jest.advanceTimersByTimeAsync(20) })
      scrollTo.mockClear()
      let preMeasureDone = false
      const pending: (() => void)[] = []
      setAnchorMeasure((callback, y) => {
        if (!preMeasureDone) { preMeasureDone = true; callback(0, y, 390, 500) }
        else pending.push(() => callback(0, y, 390, 500))
      })
      await resize(390, 844)
      expect(routeInContent(view)).toBe(false)
      expect(pending.length).toBeGreaterThan(0)
      fireEvent.press(view.getByTestId('quest-route-strip'))
      fireEvent.press(view.getByTestId('quest-route-row-p2'))
      await act(async () => { await jest.advanceTimersByTimeAsync(20) })
      expect(view.getByText('Task p2')).toBeTruthy()
      expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false })
      scrollTo.mockClear()
      await act(async () => { pending.forEach((complete) => complete()); await Promise.resolve() })
      expect(view.getByText('Task p2')).toBeTruthy()
      expect(scrollTo).not.toHaveBeenCalled()
    } finally { jest.useRealTimers() }
  })

  it('keeps pending/photo actions separate from passive language and route actions', async () => {
    const retry = jest.fn()
    const { view } = await setup(320, 640, <Pressable testID="pending-photo-retry" onPress={retry}><Text>Повторить отправку фото</Text></Pressable>)
    const notice = view.getByTestId('quest-content-locale-notice')
    expect(isDescendant(notice, view.getByTestId('quest-route-strip'))).toBe(false)
    expect(isDescendant(view.getByTestId('pending-photo-retry'), view.getByTestId('quest-header-status'))).toBe(true)
    expect(view.getByText(new RegExp(getLocaleDisplayName('ru'), 'i'))).toBeTruthy()
    fireEvent.press(notice)
    expect(view.queryByTestId('quest-route-sheet')).toBeNull()
    fireEvent.press(view.getByTestId('pending-photo-retry'))
    expect(retry).toHaveBeenCalledTimes(1)
    fireEvent.press(view.getByTestId('quest-route-strip'))
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
  })

  it('matching saved-content locale omits the notice while the route remains actionable', async () => {
    mockLocale = 'ru'
    const { view } = await setup(390, 640)
    expect(view.queryByTestId('quest-content-locale-notice')).toBeNull()
    fireEvent.press(view.getByTestId('quest-route-strip'))
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
  })
})
