/**
 * #1475 — регрессия на реальный дефект прод-главной.
 *
 * `DeferredSection` монтирует секции по IntersectionObserver с
 * `rootMargin: '600px 0px'`. Но root наблюдателя — viewport, а контент главной
 * лежит внутри RNW `ScrollView` (`overflow-y: auto`): rootMargin расширяет
 * только root и НЕ отменяет обрезку промежуточным скроллером. Из-за этого
 * обещанной предзагрузки не было вовсе, и блок городских квестов не
 * монтировался, пока пользователь не доскроллит до него физически.
 *
 * На mobile 390 hero занимает ~1360px, поэтому на первом экране секции не было
 * ни одной карточки и запрос `/api/quests/?page_size=6` не уходил совсем.
 *
 * Тест держит IntersectionObserver «молчащим» — ровно как ведёт себя браузер,
 * пока секция ниже сгиба скроллера, — и проверяет, что секция первых экранов
 * (`priority="high"`) всё равно монтируется после первой отрисовки, а
 * глубокие `low`-секции остаются отложенными.
 *
 * Точность формулировки: под react-test-renderer host-ref резолвится в `null`,
 * поэтому `useProgressiveLoad` выходит раньше `new IntersectionObserver(...)`
 * и наблюдатель здесь не конструируется. Заглушка всё равно обязательна: без
 * неё хук уходит в ветку «браузер без IntersectionObserver» и жадно монтирует
 * ВСЕ секции, из-за чего второй тест перестал бы что-либо проверять. Ветка
 * «наблюдатель живой, но не сообщает о пересечении» покрыта отдельно в
 * `__tests__/hooks/useProgressiveLoading.test.tsx` — там ref получает реальный
 * DOM-узел. Для этого теста обе ветки эквивалентны: `shouldLoad` остаётся
 * false до срабатывания таймера.
 */

import { act, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from 'react-native'

import Home from '@/components/home/Home'
import { useAuth } from '@/context/AuthContext'
import { fetchMyTravels } from '@/api/travelUserQueries'

jest.mock('@/context/AuthContext')
jest.mock('@/api/travelUserQueries')
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
  queueAnalyticsEvent: jest.fn(),
}))

jest.mock('@/components/home/HomeQuestsPromoSection', () => {
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: function MockHomeQuestsPromoSection() {
      return <View testID="home-quests-promo" />
    },
  }
})

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>

describe('Home — городские квесты монтируются без скролла (#1475)', () => {
  const originalOS = Platform.OS
  const originalObserver = (window as any).IntersectionObserver
  let queryClient: QueryClient

  class SilentIntersectionObserver {
    observe = jest.fn()
    disconnect = jest.fn()
    unobserve = jest.fn()
  }

  beforeEach(() => {
    jest.useFakeTimers()
    Platform.OS = 'web'
    ;(window as any).IntersectionObserver = SilentIntersectionObserver
    ;(global as any).IntersectionObserver = SilentIntersectionObserver

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockFetchMyTravels.mockResolvedValue({ data: [], total: 0 } as any)
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      userId: null,
      login: jest.fn(),
      logout: jest.fn(),
      setUserAvatar: jest.fn(),
      triggerProfileRefresh: jest.fn(),
    } as any)
  })

  afterEach(() => {
    jest.useRealTimers()
    Platform.OS = originalOS
    ;(window as any).IntersectionObserver = originalObserver
    ;(global as any).IntersectionObserver = originalObserver
    jest.clearAllMocks()
  })

  const renderHome = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Home />
      </QueryClientProvider>,
    )

  it('монтирует секцию квестов после первой отрисовки, даже если IntersectionObserver не срабатывает', () => {
    const { queryByTestId } = renderHome()

    // Ровно то состояние, что было на проде: наблюдатель молчит, секции нет.
    expect(queryByTestId('home-quests-promo')).toBeNull()

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(queryByTestId('home-quests-promo')).toBeTruthy()
  })

  it('не делает жадными глубокие low-секции: FAQ остаётся отложенным', () => {
    const { queryByTestId } = renderHome()

    act(() => {
      jest.advanceTimersByTime(5000)
    })

    expect(queryByTestId('home-quests-promo')).toBeTruthy()
    expect(queryByTestId('home-faq')).toBeNull()
  })

  it('ставит секцию квестов первым блоком после hero', () => {
    const { getByTestId, UNSAFE_getByType } = renderHome()

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    const scrollView = UNSAFE_getByType(require('react-native').ScrollView)
    const hero = getByTestId('home-hero')
    const promo = getByTestId('home-quests-promo')

    const order: string[] = []
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (node === hero) order.push('hero')
      if (node === promo) order.push('promo')
      const children = node.children ?? []
      for (const child of children) walk(child)
    }
    walk(scrollView)

    expect(order).toEqual(['hero', 'promo'])
  })
})
