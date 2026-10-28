import { getAllHosts, getOnlyHost } from '@/__tests__/helpers/hostQueries'
/** #2198: actual wizard composition and transient state across resize. */
import React, { useEffect, useState } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react-native'
import { Keyboard, Platform, ScrollView, StyleSheet, Text, Pressable, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { TestInstance } from 'test-renderer'

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
// The finale stays real: its own top spacing is part of the short layout.
jest.mock('@/components/quests/questWizardSections', () => ({
  QuestDesktopMapPanel: () => null,
  QuestExcursionsInline: () => null,
  QuestExcursionsSidebar: () => null,
  QuestFinalePanel: jest.requireActual('@/components/quests/questWizardSections').QuestFinalePanel,
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
import { SPACING } from '@/components/quests/questWizardStyles/shared'
import { releaseBottomChromeReserve, resetBottomChromeReserve, setBottomChromeReserve } from '@/utils/bottomChromeReserve'

const steps = ['p1', 'p2', 'p3'].map((id, index) => ({
  id, title: `Точка ${index + 1}`, location: '', story: `Story ${id}`, task: `Task ${id}`,
  lat: 53.9, lng: 27.56, answer: (value: string) => value === 'correct',
}))
const finale = { story: 'Финал' }

function isDescendant(node: TestInstance, ancestor: TestInstance): boolean {
  let parent = node.parent
  while (parent) {
    if (parent === ancestor) return true
    parent = parent.parent
  }
  return false
}

type WizardView = Awaited<ReturnType<typeof render>>
type AnchorMeasureCallback = (x: number, y: number, width: number, height: number) => void
const contentScroll = (view: WizardView) => getAllHosts(view.container, node => node.type === "RCTScrollView")
  .find((scroll) => scroll.props.keyboardShouldPersistTaps === 'handled')!
const routeInContent = (view: WizardView) => isDescendant(view.getByTestId('quest-route-strip'), contentScroll(view))

function expectSingleQuestTitle(view: WizardView) {
  // The shared web screen row uses role=heading; the quest sidebar/panel use
  // native accessibilityRole=header. Both become H1 in the browser.
  const headings = [...new Set([
    ...view.queryAllByRole('heading'),
    ...view.queryAllByRole('header'),
  ])].filter(heading => heading.props['aria-level'] === 1)
  expect(headings).toHaveLength(1)
  expect(headings[0].props.children).toBe('Тест-квест')
}

describe('QuestWizard short viewport (#2198)', () => {
  const originalOS = Platform.OS
  let mounts: number
  let unmounts: number
  let routeFocus: jest.Mock
  let scrollY: number

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
    // Measured browser geometry (#2198 prod): the reading viewport starts under
    // the 54 px screen row (short) or under the pinned 106 px header (tall);
    // the task card starts at 98 / 122 px when the reading scroll is at 0.
    const flowLayout = () => {
      const strip = view?.queryByTestId('quest-route-strip')
      return Boolean(view && strip && isDescendant(strip, contentScroll(view)))
    }
    // RN's Jest View ref is the component instance, whose native measurement
    // methods do not call back. A host ref stub does not replace that ref.
    // View and ScrollView mocks share one MockNativeMethods.measureInWindow
    // jest.fn, so a single implementation answers for both hosts.
    const measureInWindow = function (this: { props: { testID?: string; keyboardShouldPersistTaps?: string } }, callback: AnchorMeasureCallback) {
      if (this.props.testID === 'quest-main-content-anchor') {
        const y = (flowLayout() ? 98 : 122) - scrollY
        if (anchorMeasure) anchorMeasure(callback, y)
        else callback(0, y, mockViewport.width, 500)
      } else if (this.props.keyboardShouldPersistTaps === 'handled') {
        callback(0, flowLayout() ? 54 : 106, mockViewport.width, 500)
      }
    }
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(measureInWindow)
    jest.spyOn(ScrollView.prototype, 'measureInWindow').mockImplementation(measureInWindow)
    jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation((options?: { y?: number } | number) => {
      if (typeof options === 'object' && typeof options?.y === 'number') scrollY = options.y
    })
    jest.spyOn(View.prototype, 'focus').mockImplementation(function (this: { props: { testID?: string; accessibilityState?: { selected?: boolean } } }) {
      if (this.props.testID === 'quest-route-strip') routeFocus('route')
      else if (this.props.accessibilityState?.selected) routeFocus('current')
    })
    view = await render(renderNode())
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
          await view!.rerender(renderNode())
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
    scrollY = 0
    resetScreenHeaderForTests()
    resetBottomChromeReserve()
    await AsyncStorage.clear()
    window.localStorage.clear()
  })
  afterEach(async () => { await cleanup(); resetBottomChromeReserve(); jest.restoreAllMocks(); Platform.OS = originalOS })

  it('keeps the mounted web reading tail tied to the live shared notice reserve', async () => {
    const { view } = await setup(960, 640)
    const scroll = contentScroll(view)
    const padding = () => StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom
    expect(padding()).toBe(`calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + ${SPACING.xl}px)`)
    await act(() => {
      setBottomChromeReserve('consent-banner', 180)
      setBottomChromeReserve('network-status', 280)
    })
    expect(document.documentElement.style.getPropertyValue('--mt-consent-h')).toBe('280px')
    expect(contentScroll(view)).toBe(scroll)
    expect(padding()).toContain('var(--mt-consent-h, 0px)')
    await act(() => releaseBottomChromeReserve('network-status'))
    expect(document.documentElement.style.getPropertyValue('--mt-consent-h')).toBe('180px')
    expect(padding()).toContain('var(--mt-consent-h, 0px)')
  })

  it.each(['ios', 'android'] as const)('keeps the mounted %s reading tail numeric and unchanged', async os => {
    Platform.OS = os
    setBottomChromeReserve('network-status', 500)
    const { view } = await setup(390, 640)
    expect(StyleSheet.flatten(contentScroll(view).props.contentContainerStyle).paddingBottom).toBe(SPACING.xl + 96)
  })

  it.each([[320, 640, true], [390, 640, true], [390, 839, true], [390, 840, false], [390, 844, false], [599, 640, true]] as const)(
    '%dx%d has one route in the expected reading surface', async (width, height, flow) => {
      const { view } = await setup(width, height)
      expect(view.getAllByTestId('quest-route-strip')).toHaveLength(1)
      expect(getAllHosts(view.container, node => node.type === "RCTScrollView").filter((scroll) => scroll.props.keyboardShouldPersistTaps === 'handled')).toHaveLength(1)
      expect(routeInContent(view)).toBe(flow)
      expect(getAllHosts(view.container, node => node.type === "TextInput")).toHaveLength(1)
    },
  )

  it('relocates only the header; existing input, reading state and scroll host survive', async () => {
    const { view, resize } = await setup()
    const scroll = contentScroll(view)
    const input = getOnlyHost(view.container, node => node.type === "TextInput")
    await fireEvent.changeText(input, 'my unsent answer')
    await fireEvent.press(view.getByTestId('reading-state'))
    await resize(390, 640)
    expect(routeInContent(view)).toBe(true)
    expect(contentScroll(view) === scroll).toBe(true)
    expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
    expect(getOnlyHost(view.container, node => node.type === "TextInput").props.value).toBe('my unsent answer')
    expect(getOnlyHost(view.getByTestId('reading-state'), node => node.type === 'Text').props.children).toBe(1)
    expect([mounts, unmounts]).toEqual([1, 0])
    await resize(390, 844)
    expect(routeInContent(view)).toBe(false)
    expect(contentScroll(view) === scroll).toBe(true)
    expect(getOnlyHost(view.container, node => node.type === "TextInput").props.value).toBe('my unsent answer')
    expect([mounts, unmounts]).toEqual([1, 0])
  })

  it('keeps an open route sheet and current row across height and 599/600 changes', async () => {
    const { view, resize } = await setup()
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    const sheet = view.getByTestId('quest-route-sheet')
    const current = view.getByTestId('quest-route-row-p1')
    expect(current.props.accessibilityState.selected).toBe(true)
    await resize(599, 640)
    await resize(600, 640)
    await resize(390, 640)
    expect(view.getByTestId('quest-route-sheet') === sheet).toBe(true)
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
    expect(routeInContent(view)).toBe(false)
    await fireEvent.press(view.getByRole('button', { name: 'Закрыть' }))
    await act(async () => { await Promise.resolve() })
    expect(view.queryByTestId('quest-route-sheet')).toBeNull()
    expect(routeInContent(view)).toBe(true)
    expect(routeFocus).toHaveBeenCalled()
  })

  it('applies the latest desired mode only after answering ends, with the answer intact', async () => {
    const { view, resize } = await setup()
    const input = getOnlyHost(view.container, node => node.type === "TextInput")
    await fireEvent(input, 'focus')
    await fireEvent.changeText(input, 'unfinished answer')
    await resize(390, 640)
    expect(routeInContent(view)).toBe(false)
    await resize(600, 640)
    await resize(390, 844)
    await fireEvent(input, 'blur')
    await act(async () => { await Promise.resolve() })
    expect(routeInContent(view)).toBe(false)
    expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
    expect(input.props.value).toBe('unfinished answer')
    await fireEvent(input, 'focus')
    await resize(390, 640)
    await fireEvent(input, 'blur')
    await act(async () => { await Promise.resolve() })
    expect(routeInContent(view)).toBe(true)
    expect(getOnlyHost(view.container, node => node.type === "TextInput").props.value).toBe('unfinished answer')
  })

  it('closing after 599→600 restores focus to the live current-point navigation', async () => {
    const { view, resize } = await setup(599, 640)
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    await resize(600, 640)
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
    await fireEvent.press(view.getByRole('button', { name: 'Закрыть' }))
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
      const dismiss = jest.spyOn(Keyboard, 'dismiss')
      const { view, resize } = await setup()
      const scrollTo = jest.mocked(ScrollView.prototype.scrollTo)
      // Modern fake timers schedule requestAnimationFrame on 16 ms frames.
      await act(async () => { await jest.advanceTimersByTimeAsync(20) })
      scrollTo.mockClear()
      const scroll = contentScroll(view)
      await fireEvent(scroll, 'scrollBeginDrag')
      expect(dismiss).toHaveBeenCalledTimes(1)
      scrollY = 200
      await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 200, x: 0 } } })
      await resize(390, 640)
      expect(routeInContent(view)).toBe(false)
      await fireEvent(scroll, 'scrollEndDrag')
      await act(async () => { await jest.advanceTimersByTimeAsync(200) })
      expect(routeInContent(view)).toBe(true)
      // The line at the top of the visible reading area stays put: 84 px of the
      // task were above the pinned header, they stay above the screen row.
      expect(scrollTo).toHaveBeenCalledWith({ y: 228, animated: false })
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
      await fireEvent(scroll, 'touchStart')
      await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 200, x: 0 } } })
      await act(async () => { await jest.advanceTimersByTimeAsync(300) })
      await resize(390, 640)
      expect(routeInContent(view)).toBe(false)
      await act(async () => { await jest.advanceTimersByTimeAsync(300) })
      expect(routeInContent(view)).toBe(false)
      await fireEvent(scroll, release)
      await act(async () => { await jest.advanceTimersByTimeAsync(200) })
      expect(routeInContent(view)).toBe(true)
      expect(contentScroll(view) === scroll).toBe(true)
      expect([mounts, unmounts]).toEqual([1, 0])
    } finally { jest.useRealTimers() }
  })

  it('keeps an orientation-resized route sheet while live screen actions have one owner', async () => {
    const { view, resize } = await setup(390, 640, undefined, true)
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    const sheet = view.getByTestId('quest-route-sheet')
    const input = getOnlyHost(view.container, node => node.type === "TextInput")
    await fireEvent.changeText(input, 'orientation answer')
    for (const width of [767, 768, 844, 767, 390]) {
      await resize(width, 640)
      expect(view.getByTestId('quest-route-sheet') === sheet).toBe(true)
      expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
      expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
      expect(input.props.value).toBe('orientation answer')
      const mobileActions = view.queryAllByTestId('screen-header-more').length
      const panelActions = view.queryAllByTestId('quest-header-actions').length
      expect([mobileActions, panelActions]).toEqual([1, 0])
      expect(routeInContent(view)).toBe(true)
    }
  })

  it.each([[718, 735], [844, 390], [960, 640], [1024, 768], [1279, 640]] as const)(
    '%dx%d keeps tablet/landscape navigation in the reading host with one screen action owner', async (width, height) => {
      const { view, resize } = await setup(390, 640, undefined, true)
      const scroll = contentScroll(view)
      const input = getOnlyHost(view.container, node => node.type === "TextInput")
      await fireEvent.changeText(input, 'tablet draft')
      await resize(width, height)
      expect(contentScroll(view) === scroll).toBe(true)
      expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
      expect(input.props.value).toBe('tablet draft')
      expect(view.getAllByTestId('screen-header-more')).toHaveLength(1)
      expect(view.queryByTestId('quest-header-actions')).toBeNull()
      expect(isDescendant(view.getByRole('button', { name: /^Точка 1:/ }), scroll)).toBe(true)
      expect([mounts, unmounts]).toEqual([1, 0])
    },
  )

  it.each([[1279, 640, 1280, 640], [1024, 1366, 1366, 1024], [1440, 900, 1024, 768]] as const)(
    '%dx%d → %dx%d preserves an unfocused draft and the reading subtree across the sidebar boundary', async (fromW, fromH, toW, toH) => {
      const { view, resize } = await setup(fromW, fromH, undefined, true)
      const scroll = contentScroll(view)
      const input = getOnlyHost(view.container, node => node.type === "TextInput")
      await fireEvent.changeText(input, 'draft across desktop boundary')
      await fireEvent.press(view.getByTestId('reading-state'))
      for (const [width, height] of [[toW, toH], [fromW, fromH]]) {
        await resize(width, height)
        expect(contentScroll(view) === scroll).toBe(true)
        expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
        expect(input.props.value).toBe('draft across desktop boundary')
        expect(getOnlyHost(view.getByTestId('reading-state'), node => node.type === 'Text').props.children).toBe(1)
        expect(Boolean(view.queryByTestId('quest-desktop-sidebar'))).toBe(width >= 1280)
        expectSingleQuestTitle(view)
        expect([mounts, unmounts]).toEqual([1, 0])
      }
    },
  )

  it('keeps the route sheet across a jump to desktop, then returns focus to the sidebar current point', async () => {
    const { view, resize } = await setup(390, 640, undefined, true)
    const scroll = contentScroll(view)
    const input = getOnlyHost(view.container, node => node.type === "TextInput")
    await fireEvent.changeText(input, 'sheet draft')
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    const sheet = view.getByTestId('quest-route-sheet')
    await resize(1440, 900)
    expect(view.getByTestId('quest-route-sheet') === sheet).toBe(true)
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
    expect(view.queryByTestId('quest-desktop-sidebar')).toBeNull()
    expectSingleQuestTitle(view)
    await fireEvent.press(view.getByRole('button', { name: 'Закрыть' }))
    await act(async () => { await Promise.resolve() })
    expect(view.queryByTestId('quest-route-sheet')).toBeNull()
    expect(view.getByTestId('quest-desktop-sidebar')).toBeTruthy()
    expect(routeFocus).toHaveBeenLastCalledWith('current')
    expect(contentScroll(view) === scroll).toBe(true)
    expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
    expect(input.props.value).toBe('sheet draft')
    await resize(390, 640)
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    expect(view.getByTestId('quest-route-sheet')).toBeTruthy()
    await fireEvent.press(view.getByRole('button', { name: 'Закрыть' }))
    expect(view.queryByTestId('quest-route-sheet')).toBeNull()
    expect([mounts, unmounts]).toEqual([1, 0])
  })

  it('defers the desktop panel handoff until input blur without duplicating the live title owner', async () => {
    const { view, resize } = await setup(1024, 768, undefined, true)
    const scroll = contentScroll(view)
    const input = getOnlyHost(view.container, node => node.type === "TextInput")
    await fireEvent(input, 'focus')
    await fireEvent.changeText(input, 'focused tablet draft')
    await resize(1366, 1024)
    expect(view.queryByTestId('quest-desktop-sidebar')).toBeNull()
    expectSingleQuestTitle(view)
    await fireEvent(input, 'blur')
    await act(async () => { await Promise.resolve() })
    expect(view.getByTestId('quest-desktop-sidebar')).toBeTruthy()
    await fireEvent(input, 'focus')
    await resize(1024, 768)
    expect(view.queryByTestId('quest-desktop-sidebar')).toBeNull()
    expect(view.getAllByTestId('screen-header-more')).toHaveLength(1)
    expect(view.queryByTestId('quest-header-actions')).toBeNull()
    expectSingleQuestTitle(view)
    await fireEvent(input, 'blur')
    await act(async () => { await Promise.resolve() })
    expect(contentScroll(view) === scroll).toBe(true)
    expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
    expect(input.props.value).toBe('focused tablet draft')
    expect([mounts, unmounts]).toEqual([1, 0])
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
      const input = getOnlyHost(view.container, node => node.type === "TextInput")
      await fireEvent(input, 'focus')
      await fireEvent.changeText(input, 'keyboard answer')
      await act(async () => { viewport.resizeTo(512); await jest.advanceTimersByTimeAsync(20) })
      await fireEvent(input, 'blur')
      await resize(390, 844)
      expect(routeInContent(view)).toBe(true)
      expect(input.props.value).toBe('keyboard answer')
      await act(async () => { viewport.resizeTo(844); await jest.advanceTimersByTimeAsync(200) })
      expect(routeInContent(view)).toBe(false)
      expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
      expect(contentScroll(view) === scroll).toBe(true)
      expect([mounts, unmounts]).toEqual([1, 0])
    } finally {
      await cleanup()
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
    const input = getOnlyHost(view.container, node => node.type === "TextInput")
    await fireEvent.changeText(input, 'offline draft')
    ;(AsyncStorage.setItem as jest.Mock).mockClear()
    await resize(390, 640)
    expect(getOnlyHost(view.container, node => node.type === "TextInput") === input).toBe(true)
    expect(input.props.value).toBe('offline draft')
    expect(view.getByTestId('quest-content-locale-notice')).toBeTruthy()
    await fireEvent.press(view.getByTestId('quest-route-strip'))
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
      const { view, resize, setAnchorMeasure } = await setup(390, 640)
      const scrollTo = jest.mocked(ScrollView.prototype.scrollTo)
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
      await fireEvent.press(view.getByTestId('quest-route-strip'))
      await fireEvent.press(view.getByTestId('quest-route-row-p2'))
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
    await fireEvent.press(notice)
    expect(view.queryByTestId('quest-route-sheet')).toBeNull()
    await fireEvent.press(view.getByTestId('pending-photo-retry'))
    expect(retry).toHaveBeenCalledTimes(1)
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
  })

  it('matching saved-content locale omits the notice while the route remains actionable', async () => {
    mockLocale = 'ru'
    const { view } = await setup(390, 640)
    expect(view.queryByTestId('quest-content-locale-notice')).toBeNull()
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    expect(view.getByTestId('quest-route-row-p1').props.accessibilityState.selected).toBe(true)
  })
  it.each([
    ['short at the start → tall shows the start under the pinned header', 320, 640, 390, 844, 0, 0],
    ['tall at the start → short shows the route row again', 390, 844, 320, 640, 0, 0],
    ['short inside the header row → tall shows the start', 320, 640, 390, 844, 30, 0],
    ['short reading line → tall keeps the same line below the pinned header', 320, 640, 390, 844, 200, 172],
  ] as const)('resize anchor: %s', async (_case, fromW, fromH, toW, toH, offset, expected) => {
    jest.useFakeTimers()
    try {
      const { view, resize } = await setup(fromW, fromH)
      await act(async () => { await jest.advanceTimersByTimeAsync(20) })
      if (offset) {
        scrollY = offset
        await fireEvent.scroll(contentScroll(view), { nativeEvent: { contentOffset: { y: offset, x: 0 } } })
        await act(async () => { await jest.advanceTimersByTimeAsync(200) })
      }
      const scrollTo = jest.mocked(ScrollView.prototype.scrollTo)
      scrollTo.mockClear()
      await resize(toW, toH)
      await act(async () => { await jest.advanceTimersByTimeAsync(200) })
      expect(routeInContent(view)).toBe(toH < 840)
      expect(scrollY).toBe(expected)
      if (!expected) {
        // The task card never starts under the pinned chrome after a resize.
        const cardTop = (toH < 840 ? 98 : 122) - scrollY
        expect(cardTop).toBe(toH < 840 ? 98 : 122)
      }
    } finally { jest.useRealTimers() }
  })

  it('the finale starts right under the route row in the short layout, like the intro/step card', async () => {
    const finaleTop = (view: WizardView) =>
      StyleSheet.flatten(view.getByTestId('quest-finale-panel').props.style).marginTop ?? 0
    const { view, resize } = await setup(320, 640)
    await fireEvent.press(view.getByTestId('quest-route-strip'))
    await fireEvent.press(view.getByTestId('quest-nav-finale'))
    await act(async () => { await Promise.resolve() })
    expect(routeInContent(view)).toBe(true)
    expect(finaleTop(view)).toBe(0)
    await resize(390, 844)
    expect(routeInContent(view)).toBe(false)
    expect(finaleTop(view)).toBe(SPACING.xs)
    await resize(320, 640)
    expect(routeInContent(view)).toBe(true)
    expect(finaleTop(view)).toBe(0)
  })
  it('a reader gesture during the pending relocation measurement wins over the compensation', async () => {
    jest.useFakeTimers()
    try {
      const { view, resize, setAnchorMeasure } = await setup(390, 844)
      await act(async () => { await jest.advanceTimersByTimeAsync(20) })
      scrollY = 200
      await fireEvent.scroll(contentScroll(view), { nativeEvent: { contentOffset: { y: 200, x: 0 } } })
      await act(async () => { await jest.advanceTimersByTimeAsync(200) })
      // Only the first post-relocation measurement is slow; later ones answer at once.
      let measures = 0
      const pending: (() => void)[] = []
      setAnchorMeasure((callback, y) => {
        measures += 1
        if (measures === 2) pending.push(() => callback(0, y, 390, 500))
        else callback(0, y, 390, 500)
      })
      const scrollTo = jest.mocked(ScrollView.prototype.scrollTo)
      scrollTo.mockClear()
      await resize(390, 640)
      expect(routeInContent(view)).toBe(true)
      expect(pending.length).toBeGreaterThan(0)
      await fireEvent(contentScroll(view), 'touchStart')
      scrollY = 260
      await fireEvent.scroll(contentScroll(view), { nativeEvent: { contentOffset: { y: 260, x: 0 } } })
      await fireEvent(contentScroll(view), 'touchEnd')
      await act(async () => { pending.forEach((complete) => complete()); await jest.advanceTimersByTimeAsync(200) })
      expect(scrollTo).not.toHaveBeenCalled()
      expect(scrollY).toBe(260)
    } finally { jest.useRealTimers() }
  })
})
