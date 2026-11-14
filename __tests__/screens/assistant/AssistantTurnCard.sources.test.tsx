/**
 * #3295: под ответом ассистента — карточки названных материалов с обложкой и действиями «В план поездки»
 * и «На карте»; остальное свёрнуто под «Ещё материалы».
 */
import { fireEvent, render, screen } from '@testing-library/react-native'

const mockPush = jest.fn()
const mockRequireAuth = jest.fn()
const authState = { isAuthenticated: true }
const mockAnalytics = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  router: { push: jest.fn() },
}))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))
jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ loginHref: '/login', requireAuth: mockRequireAuth, authReady: true }),
}))
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: (...args: unknown[]) => mockAnalytics(...args),
}))
// Кнопка статуса статьи — та же, что на странице статьи; здесь важно, что карточка рисует именно её.
jest.mock('@/components/travel/TravelStatusButton', () => {
  const { Pressable, Text } = require('react-native')
  return function TravelStatusButton(props: { travelId: string; idleLabel?: string; onActivate?: () => void; travelUrl: string; size?: string }) {
    return (
      <Pressable testID={`travel-status-${props.travelId}`} onPress={props.onActivate} accessibilityLabel={`${props.size}:${props.travelUrl}`}>
        <Text>{props.idleLabel}</Text>
      </Pressable>
    )
  }
})
jest.mock('@/components/ui/CardRail', () => {
  const { View } = require('react-native')
  return function CardRail({ children, testID }: { children: unknown; testID?: string }) {
    return <View testID={testID}>{children}</View>
  }
})

import type { AiSource } from '@/api/aiAssist/types'
import { ASSISTANT_SOURCE_ACTION_EVENT } from '@/components/screens/assistant/AssistantSourceCards'
import { AssistantTurnCard } from '@/components/screens/assistant/AssistantTurnCard'
import { hasDisplayFields, sourceCoordinates, splitAnswerSources } from '@/components/screens/assistant/answerSources'
import { createAssistantStyles } from '@/components/screens/assistant/assistantStyles'
import type { AssistantTurn } from '@/components/screens/assistant/useAssistantChat'
import { useThemedColors } from '@/hooks/useTheme'

const quest: AiSource = {
  type: 'quest',
  source_id: '7',
  title: 'Квест по Гродно: королевский город над Неманом',
  url: 'https://metravel.by/quests/11/grodno-royal',
  path: '/quests/11/grodno-royal',
  snippet: 'Городской квест по городу Гродно (Беларусь). Точек: 10. Длительность: 100 мин',
  score: 0.8,
  group: 'match',
  cover: 'https://metravel.by/quest-cover/7.webp',
  city: 'Гродно',
  country: 'Беларусь',
  lat: 53.677,
  lng: 23.829,
}
const travel: AiSource = {
  type: 'travel',
  source_id: '153',
  title: 'Гродно за 1 день: что посмотреть и как доехать',
  url: 'https://metravel.by/travels/grodno-za-1-den',
  path: '/travels/grodno-za-1-den',
  snippet: 'Беларусь. Дней: 1. Старый замок и Коложа',
  score: 0.7,
  group: 'match',
  cover: 'https://metravel.by/travel-image/153.webp',
  city: null,
  country: 'Беларусь',
  lat: null,
  lng: null,
}
const nearby: AiSource = { ...travel, source_id: '566', title: 'Куда поехать в Беларуси на выходные', url: 'https://metravel.by/travels/kuda-poekhat', path: '/travels/kuda-poekhat', group: 'nearby' }
const unnamed: AiSource = { ...quest, source_id: '53', title: 'Квест по Гродно: Городница Тызенгауза', url: 'https://metravel.by/quests/11/grodno-gorodnitsa', path: '/quests/11/grodno-gorodnitsa' }
const help: AiSource = { type: 'help', source_id: '1', title: 'Сколько стоит пройти квест?', url: 'https://metravel.by/quests', path: '/quests', snippet: 'Бесплатно.', score: 0.7, group: 'match' }

const answer = `В Гродно начните с [${travel.title}](${travel.url}), затем пройдите [${quest.title}](${quest.url}).`

const turn = (patch: Partial<AssistantTurn> = {}): AssistantTurn => ({
  id: 't1',
  question: 'Что посмотреть в Гродно?',
  answer,
  sources: [quest, unnamed, travel, nearby],
  status: 'done',
  removedLinks: 0,
  retryAfterSec: null,
  usage: null,
  offTopicStrikes: null,
  ...patch,
})

function Card({ item, narrow = false }: { item: AssistantTurn; narrow?: boolean }) {
  const colors = useThemedColors()
  const styles = createAssistantStyles(colors, narrow)
  return <AssistantTurnCard turn={item} styles={styles} colors={colors} busy={false} onRetry={jest.fn()} onOpenCatalog={jest.fn()} narrow={narrow} />
}

describe('источники хода: названные в ответе — первыми (#3295)', () => {
  it('названные в ответе карточки идут в порядке упоминания, остальные — в прежнем порядке', () => {
    const split = splitAnswerSources(answer, [quest, unnamed, travel, nearby])
    expect(split.recommended.map((source) => source.source_id)).toEqual(['153', '7'])
    expect(split.rest.map((source) => source.source_id)).toEqual(['53', '566'])
    // Голый адрес карточки и адрес с точкой в конце — тоже упоминание; чужой адрес — нет.
    expect(splitAnswerSources(`Смотрите ${quest.url}. И https://metravel.by/travels/pridumano`, [quest, travel]).recommended).toEqual([quest])
    expect(splitAnswerSources('', [quest]).recommended).toEqual([])
  })

  it('карточкой рисуется источник с полями показа; справка и источник без полей — строкой', () => {
    expect(hasDisplayFields(quest)).toBe(true)
    expect(hasDisplayFields(travel)).toBe(true)
    const { cover: _cover, city: _city, country: _country, lat: _lat, lng: _lng, ...plain } = quest
    expect(hasDisplayFields(plain)).toBe(false)
    expect(hasDisplayFields({ ...help, cover: null })).toBe(false)
    expect(sourceCoordinates(quest)).toEqual({ lat: 53.677, lng: 23.829 })
    expect(sourceCoordinates(travel)).toBeNull()
    expect(sourceCoordinates({ lat: 53, lng: undefined })).toBeNull()
  })
})

describe('AssistantTurnCard: карточки материалов и действия (#3295)', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockRequireAuth.mockClear()
    mockAnalytics.mockClear()
    authState.isAuthenticated = true
  })

  it('под ответом — карточки названных материалов с отметкой; остальные свёрнуты под «Ещё материалы»', async () => {
    await render(<Card item={turn()} />)
    expect(screen.getByTestId('assistant-source-cards')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-card-travel-153')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-card-quest-7')).toBeTruthy()
    expect(screen.getAllByText('Из ответа')).toHaveLength(2)
    // Неназванные материалы не видны, пока список свёрнут.
    expect(screen.queryByTestId('assistant-source-quest-53')).toBeNull()
    expect(screen.queryByTestId('assistant-source-travel-566')).toBeNull()
    expect(screen.getByText('Ещё материалы (2)')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('assistant-sources-more'))
    expect(screen.getByTestId('assistant-source-quest-53')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-travel-566')).toBeTruthy()
    expect(screen.getByTestId('assistant-sources-nearby')).toBeTruthy()
    expect(screen.getByText('Свернуть')).toBeTruthy()
    // Названные карточки строкой не дублируются.
    expect(screen.queryByTestId('assistant-source-quest-7')).toBeNull()
  })

  it('«На карте»: карта с центром в координатах карточки; у карточки без координат действия нет', async () => {
    await render(<Card item={turn()} />)
    expect(screen.queryByTestId('assistant-source-map-travel-153')).toBeNull()
    await fireEvent.press(screen.getByTestId('assistant-source-map-quest-7'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/map', params: { lat: '53.677', lng: '23.829', placeTitle: quest.title, focusPlace: '1' } })
    expect(mockAnalytics).toHaveBeenCalledWith(ASSISTANT_SOURCE_ACTION_EVENT, { action: 'map', type: 'quest', id: 7 })
  })

  it('«В план поездки»: у статьи — кнопка статуса со страницы статьи; у квеста — новая поездка по квесту', async () => {
    await render(<Card item={turn()} />)
    // Статья: та же кнопка, что на странице статьи, с подписью «В план поездки» и путём статьи.
    const status = screen.getByTestId('travel-status-153')
    expect(status.props.accessibilityLabel).toBe('undefined:/travels/grodno-za-1-den')
    expect(screen.getAllByText('В план поездки').length).toBeGreaterThanOrEqual(2)
    await fireEvent.press(status)
    expect(mockAnalytics).toHaveBeenLastCalledWith(ASSISTANT_SOURCE_ACTION_EVENT, { action: 'plan', type: 'travel', id: 153 })

    // Квест: вошедший попадает в форму новой поездки с названием и адресом квеста.
    await fireEvent.press(screen.getByTestId('assistant-source-plan-quest-7'))
    expect(mockAnalytics).toHaveBeenLastCalledWith(ASSISTANT_SOURCE_ACTION_EVENT, { action: 'plan', type: 'quest', id: 7 })
    const href = String(mockPush.mock.calls.at(-1)?.[0])
    expect(href.startsWith('/trips/plan/create?')).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('source')).toBe('quest')
    expect(params.get('sourceTravelTitle')).toBe(quest.title)
    expect(params.get('sourceTravelUrl')).toBe(quest.url)
  })

  it('гость: «В план поездки» у квеста ведёт на вход с возвратом в форму поездки, в планировщик не переходит', async () => {
    authState.isAuthenticated = false
    await render(<Card item={turn()} />)
    await fireEvent.press(screen.getByTestId('assistant-source-plan-quest-7'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    const login = String(mockPush.mock.calls[0][0])
    expect(login).toMatch(/^\/(login|registration)\?/)
    const params = new URLSearchParams(login.split('?')[1])
    expect(params.get('intent')).toBe('plan-trip')
    expect(String(params.get('redirect')).startsWith('/trips/plan/create?')).toBe(true)
  })

  it('источники без полей показа, справка и ответ без названных материалов — прежний список строк, развёрнутый', async () => {
    const strip = ({ cover: _cover, city: _city, country: _country, lat: _lat, lng: _lng, ...rest }: AiSource): AiSource => rest
    const old = await render(<Card item={turn({ sources: [strip(quest), strip(travel)] })} />)
    expect(screen.queryByTestId('assistant-source-cards')).toBeNull()
    expect(screen.queryByTestId('assistant-sources-more')).toBeNull()
    expect(screen.getByTestId('assistant-source-quest-7')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-travel-153')).toBeTruthy()
    await old.unmount()

    // Запасной ответ: в тексте ничего не названо — карточек нет, источники строками.
    const fallback = await render(<Card item={turn({ answer: '', fallback: true })} />)
    expect(screen.queryByTestId('assistant-source-cards')).toBeNull()
    expect(screen.getByTestId('assistant-source-quest-7')).toBeTruthy()
    expect(screen.getByTestId('assistant-source-travel-566')).toBeTruthy()
    await fallback.unmount()

    // Справка о сайте — строкой даже со ссылкой в ответе.
    await render(<Card item={turn({ answer: `Бесплатно.\n\n[Квесты](${help.url})`, sources: [help] })} />)
    expect(screen.queryByTestId('assistant-source-cards')).toBeNull()
    expect(screen.getByTestId('assistant-source-help-1')).toBeTruthy()
  })

  it('все источники названы в ответе — кнопки «Ещё материалы» нет', async () => {
    await render(<Card item={turn({ sources: [quest, travel] })} narrow />)
    expect(screen.getByTestId('assistant-source-cards')).toBeTruthy()
    expect(screen.queryByTestId('assistant-sources-more')).toBeNull()
  })
})
