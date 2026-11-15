/**
 * #3298, #3416 п.1: экран новой поездки принимает точки маршрута — черновик плана ассистента по
 * идентификатору из адреса либо одну точку материала из параметров ссылки.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockParams: Record<string, string> = {}
let mockAuthState: { authReady: boolean; isAuthenticated: boolean; userId?: string | null } = { authReady: true, isAuthenticated: true }
const mockForm = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, [cb]),
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}))
jest.mock('@/components/trips/TripsPageSeo', () => ({ __esModule: true, default: () => null, getTripsRouteSeo: () => ({ title: 't', canonicalPath: '/trips/plan/create' }) }))
jest.mock('@/components/trips/planning/TripCreateForm', () => {
  return function TripCreateForm(props: unknown) {
    mockForm(props)
    const { Text } = require('react-native')
    return <Text testID="trip-create-form">form</Text>
  }
})

import CreateTripScreen from '@/app/(tabs)/trips/plan/create'
import { loadTripPlanDraft, saveTripPlanDraft } from '@/utils/tripPlanDraft'

type FormProps = { initialValues?: { title?: string; description?: string; endDate?: string; startDate?: string }; routeDraft?: Array<{ name: string; dayNumber?: number | null; type: string }>; onCreated: (trip: { id: number }, routeSaved: boolean) => void }
const lastProps = (): FormProps => mockForm.mock.calls.at(-1)![0] as FormProps

const DRAFT = {
  title: 'Спланируй два дня в Кракове',
  description: 'Спланируй два дня в Кракове\nДень 1: «Квест по Кракову» (≈ 2 ч)\nДень 2: «Вокруг Кракова» (≈ 4 ч)',
  days: 2,
  points: [
    { type: 'quest' as const, sourceId: 246, title: 'Квест по Кракову', lat: 50.054, lng: 19.935, day: 1 },
    { type: 'travel' as const, sourceId: 636, title: 'Вокруг Кракова', lat: 50.2, lng: 19.83, day: 2 },
  ],
}

describe('экран новой поездки: приём точек маршрута (#3298, #3416)', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    mockAuthState = { authReady: true, isAuthenticated: true }
    mockParams = {}
    await AsyncStorage.clear()
  })

  it('черновик плана: форма получает название, описание по дням, дату окончания и точки с днями', async () => {
    const id = (await saveTripPlanDraft(DRAFT))!
    mockParams = { source: 'plan', draft: id }
    const view = await render(<CreateTripScreen />)
    await waitFor(() => expect(view.getByTestId('trip-create-form')).toBeTruthy())
    const props = lastProps()
    expect(props.initialValues).toMatchObject({ title: DRAFT.title, description: DRAFT.description })
    expect(props.initialValues?.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(props.initialValues?.endDate).not.toBe(props.initialValues?.startDate)
    expect(props.routeDraft?.map((point) => [point.name, point.dayNumber, point.type])).toEqual([
      ['Квест по Кракову', 1, 'custom'],
      ['Вокруг Кракова', 2, 'place'],
    ])

    // Маршрут сохранён — черновик удаляется, открывается поездка.
    await act(async () => props.onCreated({ id: 77 }, true))
    expect(mockReplace).toHaveBeenCalledWith('/trips/plan/77')
    await waitFor(async () => expect(await loadTripPlanDraft(id)).toBeNull())
  })

  it('маршрут не сохранился — черновик остаётся в хранилище', async () => {
    const id = (await saveTripPlanDraft(DRAFT))!
    mockParams = { source: 'plan', draft: id }
    const view = await render(<CreateTripScreen />)
    await waitFor(() => expect(view.getByTestId('trip-create-form')).toBeTruthy())
    await act(async () => lastProps().onCreated({ id: 78 }, false))
    expect(mockReplace).toHaveBeenCalledWith('/trips/plan/78')
    expect(await loadTripPlanDraft(id)).not.toBeNull()
  })

  it('черновика с таким идентификатором нет — обычная пустая форма', async () => {
    mockParams = { source: 'plan', draft: 'zzzzzzzz' }
    const view = await render(<CreateTripScreen />)
    await waitFor(() => expect(view.getByTestId('trip-create-form')).toBeTruthy())
    expect(lastProps().routeDraft).toEqual([])
    expect(lastProps().initialValues).toEqual({})
  })

  it('одна точка материала из параметров ссылки: квест встаёт точкой маршрута', async () => {
    mockParams = { source: 'quest', sourceTravelTitle: 'Квест по Гродно', sourceTravelUrl: 'https://metravel.by/quests/11', sourcePoint: '53.67790,23.82930' }
    const view = await render(<CreateTripScreen />)
    await waitFor(() => expect(view.getByTestId('trip-create-form')).toBeTruthy())
    expect(lastProps().routeDraft).toEqual([expect.objectContaining({ name: 'Квест по Гродно', type: 'custom', coordinates: [23.8293, 53.6779], dayNumber: null })])
    expect(lastProps().initialValues?.title).toContain('Квест по Гродно')
  })

  it('черновик другого вошедшего пользователя не подхватывается и удаляется; свой — читается', async () => {
    const id = (await saveTripPlanDraft(DRAFT, '42'))!
    mockParams = { source: 'plan', draft: id }
    mockAuthState = { authReady: true, isAuthenticated: true, userId: '42' }
    const own = await render(<CreateTripScreen />)
    await waitFor(() => expect(own.getByTestId('trip-create-form')).toBeTruthy())
    expect(lastProps().routeDraft).toHaveLength(2)
    await own.unmount()

    mockAuthState = { authReady: true, isAuthenticated: true, userId: '7' }
    const other = await render(<CreateTripScreen />)
    await waitFor(() => expect(other.getByTestId('trip-create-form')).toBeTruthy())
    expect(lastProps().routeDraft).toEqual([])
    expect(await AsyncStorage.getItem('metravel:tripPlanDraft')).toBeNull()
  })

  it('сессия ещё восстанавливается — черновик не читается и не удаляется', async () => {
    const id = (await saveTripPlanDraft(DRAFT, '42'))!
    mockParams = { source: 'plan', draft: id }
    mockAuthState = { authReady: false, isAuthenticated: false, userId: null }
    const view = await render(<CreateTripScreen />)
    expect(view.queryByTestId('trip-create-form')).toBeNull()
    expect(await loadTripPlanDraft(id, '42')).not.toBeNull()
  })

  it('гость с черновиком: вход возвращает в ту же форму с тем же идентификатором', async () => {
    mockAuthState = { authReady: true, isAuthenticated: false }
    mockParams = { source: 'plan', draft: 'abc12345' }
    const view = await render(<CreateTripScreen />)
    expect(view.queryByTestId('trip-create-form')).toBeNull()
    await fireEvent.press(view.getByTestId('trip-create-login-link'))
    const href = String(mockPush.mock.calls[0][0])
    expect(new URLSearchParams(href.split('?')[1]).get('redirect')).toBe('/trips/plan/create?source=plan&draft=abc12345')
    expect(href).toContain('intent=plan-trip')
  })
})
