/**
 * #3357: блок «Ещё в мире» под ответом ассистента — маршруты мира из внешнего индекса службы: факты,
 * ступень нагрузки, строка об источниках данных и ссылка на статью, которая открывается вне сайта.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

const mockPush = jest.fn()
const mockOpenExternal = jest.fn(async (..._args: unknown[]) => true)
const mockAnalytics = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  router: { push: jest.fn() },
}))
jest.mock('@/utils/externalLinks', () => ({
  ...jest.requireActual('@/utils/externalLinks'),
  openExternalUrlInNewTab: (...args: unknown[]) => mockOpenExternal(...args),
}))
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: (...args: unknown[]) => mockAnalytics(...args),
}))
jest.mock('@/api/aiAssist/limits', () => ({
  AI_OFFTOPIC_STRIKES_TO_BLOCK: 3,
  consumeQuestion: jest.fn(async () => ({ allowed: true, remaining: 19 })),
  readRemainingQuestions: jest.fn(async () => 20),
  readOffTopicState: jest.fn(async () => ({ strikes: 0, blocked: false })),
  registerOffTopicStrike: jest.fn(async () => ({ strikes: 1, blocked: false })),
}))
jest.mock('@/api/aiAssist/demandLog', () => ({ logDemand: jest.fn(async () => []) }))

import type { AskClient, AskResult } from '@/api/aiAssist/askProvider'
import type { AiWorldTrail } from '@/api/aiAssist/trailFacts'
import type { AiSource } from '@/api/aiAssist/types'
import { AssistantTurnCard } from '@/components/screens/assistant/AssistantTurnCard'
import { OSM_COPYRIGHT_URL, WORLD_TRAIL_OPEN_EVENT, worldEffortText, worldFactsText, worldMonthsText } from '@/components/screens/assistant/AssistantWorldTrails'
import { ASSISTANT_TOUCH_TARGET, createAssistantStyles } from '@/components/screens/assistant/assistantStyles'
import { type AssistantTurn, useAssistantChat } from '@/components/screens/assistant/useAssistantChat'
import { useThemedColors } from '@/hooks/useTheme'
import { toTrailCard } from '@/scripts/ai-index/world/cards'

import { WORLD_OPEN_LAYER, WORLD_OSM_LAYER } from '../../fixtures/worldTrails'

const cardOf = (id: string): AiWorldTrail =>
  toTrailCard(WORLD_OSM_LAYER.find((record) => record.source_id === id)!, WORLD_OPEN_LAYER.find((record) => record.source_id === id)!, 'ru')!

/** Разделитель разрядов локали — неразрывный пробел: в сравнении он равен обычному. */
const plain = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ')

const whw = cardOf('Q965998')
const tmb = cardOf('Q24777')
const gr20 = cardOf('Q262374')
const LAYER_URL = 'https://metravel.by/assets/data/world-trails-osm.jsonl'

const travel: AiSource = {
  type: 'travel',
  source_id: '505',
  title: 'Mullerthal Trail: 112 км по Люксембургу',
  url: 'https://metravel.by/travels/mullerthal-trail',
  path: '/travels/mullerthal-trail',
  snippet: 'Люксембург. Дней: 6. Длина: 112 км',
  score: 0.9,
}

const turn = (patch: Partial<AssistantTurn> = {}): AssistantTurn => ({
  id: 't1',
  question: 'Пеший маршрут не более 200 км',
  answer: `Пройдите [${travel.title}](${travel.url}).`,
  sources: [travel],
  status: 'done',
  removedLinks: 0,
  retryAfterSec: null,
  usage: null,
  offTopicStrikes: null,
  world: [whw, tmb, gr20],
  ...patch,
})

function Card({ item, narrow = false }: { item: AssistantTurn; narrow?: boolean }) {
  const colors = useThemedColors()
  const styles = createAssistantStyles(colors, narrow)
  return <AssistantTurnCard turn={item} styles={styles} colors={colors} busy={false} onRetry={jest.fn()} onOpenCatalog={jest.fn()} narrow={narrow} />
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('блок «Ещё в мире» (#3357)', () => {
  it('стоит под материалами сайта: заголовок, три маршрута, строка об источниках данных', async () => {
    await render(<Card item={turn()} />)
    expect(screen.getByTestId('assistant-world')).toBeTruthy()
    expect(screen.getByText('Ещё в мире')).toBeTruthy()
    for (const trail of [whw, tmb, gr20]) expect(screen.getByTestId(`assistant-world-trail-${trail.source_id}`)).toBeTruthy()
    const attribution = screen.getByTestId('assistant-world-attribution').props.children as string
    for (const source of ['OpenStreetMap', 'ODbL', 'Wikidata', 'Copernicus DEM', 'NASA POWER']) expect(attribution).toContain(source)
    // Источник сайта остался строкой выше и ведёт внутрь приложения.
    expect(screen.getByTestId('assistant-source-travel-505')).toBeTruthy()
  })

  it('карточка показывает факты: длину, дни, набор высоты и высшую точку; оценочные дни помечены', async () => {
    expect(plain(worldFactsText(whw))).toBe('153 км · Дней: 8 · Набор высоты: около 3 200 м · Высшая точка: 550 м')
    expect(plain(worldFactsText(tmb))).toBe('166 км · Дней: около 9 (оценка) · Набор высоты: около 9 900 м · Высшая точка: 2 540 м')
    await render(<Card item={turn()} />)
    expect(screen.getByText(worldFactsText(tmb))).toBeTruthy()
    expect(screen.getByText('Швейцария, Франция, Италия')).toBeTruthy()
    // Факта нет — в строке его нет.
    expect(plain(worldFactsText({ ...whw, days: undefined, ascent_m: undefined, max_alt_m: undefined }))).toBe('153 км')
  })

  it('ступень нагрузки — текстом; ступень по классу тропы подписана «по разметке OpenStreetMap»', async () => {
    expect(worldEffortText(whw)).toBe('Нагрузка: поход · Класс тропы: T1')
    expect(worldEffortText(tmb)).toBe('Нагрузка: поход для подготовленных · Класс тропы: T2')
    expect(worldEffortText(gr20)).toBe('Нагрузка: нужен горный опыт · Класс тропы: T4 · по разметке OpenStreetMap')
    await render(<Card item={turn()} />)
    expect(screen.getByTestId(`assistant-world-effort-${gr20.source_id}`).props.children).toBe(worldEffortText(gr20))
  })

  it('месяцы — «без снега по климатической норме»; круглогодичный вердикт не обещает, что маршрут открыт', () => {
    expect(worldMonthsText(tmb)).toBe('Без снега по климатической норме: июль–август')
    expect(worldMonthsText(gr20)).toBe('Без снега по климатической норме: июнь–октябрь')
    expect(worldMonthsText(whw)).toBe('Без устойчивого снега круглый год (по норме)')
    expect(worldMonthsText({ ...whw, months: [1, 2, 3, 12] })).toBe('Без снега по климатической норме: декабрь–март')
    expect(worldMonthsText({ ...whw, months: undefined })).toBe('')
  })

  it('нажатие открывает статью вне сайта через общий помощник внешних ссылок, а не роутер приложения', async () => {
    await render(<Card item={turn()} />)
    const row = screen.getByTestId(`assistant-world-trail-${whw.source_id}`)
    expect(row.props.accessibilityRole).toBe('link')
    expect(row.props.accessibilityHint).toBe('Откроется вне сайта')
    expect(row.props.accessibilityLabel).toContain('West Highland Way')
    // #3431: строка — настоящая ссылка с адресом статьи, новой вкладкой и `noopener`, а не `div role="link"`.
    expect(row.props.href).toBe('https://en.wikipedia.org/wiki/West_Highland_Way')
    expect(row.props.hrefAttrs).toEqual({ target: '_blank', rel: 'noopener' })
    await fireEvent.press(row)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://en.wikipedia.org/wiki/West_Highland_Way')
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockAnalytics).toHaveBeenCalledWith(WORLD_TRAIL_OPEN_EVENT, { id: whw.source_id })
  })

  it('строка-ссылка сохраняет отклик нажатия и наведения строки источника (#3431)', async () => {
    await render(<Card item={turn()} />)
    const opacity = () => StyleSheet.flatten(screen.getByTestId(`assistant-world-trail-${whw.source_id}`).props.style)?.opacity
    expect(opacity()).toBeUndefined()
    await fireEvent(screen.getByTestId(`assistant-world-trail-${whw.source_id}`), 'pressIn')
    expect(opacity()).toBe(0.8)
    await fireEvent(screen.getByTestId(`assistant-world-trail-${whw.source_id}`), 'pressOut')
    expect(opacity()).toBeUndefined()
    await fireEvent(screen.getByTestId(`assistant-world-trail-${whw.source_id}`), 'hoverIn')
    expect(opacity()).toBe(0.8)
    await fireEvent(screen.getByTestId(`assistant-world-trail-${whw.source_id}`), 'hoverOut')
    expect(opacity()).toBeUndefined()
  })

  it('цель касания строки маршрута не меньше принятой на экране', async () => {
    const { result } = await renderHook(() => createAssistantStyles(useThemedColors(), true))
    expect(result.current.worldRow.minHeight).toBe(ASSISTANT_TOUCH_TARGET)
    expect(ASSISTANT_TOUCH_TARGET).toBeGreaterThanOrEqual(44)
  })

  it('условия OpenStreetMap открываются ссылкой; обязательные строки лицензий раскрываются по кнопке', async () => {
    await render(<Card item={turn()} />)
    await fireEvent.press(screen.getByTestId('assistant-world-license'))
    expect(mockOpenExternal).toHaveBeenCalledWith(OSM_COPYRIGHT_URL)
    expect(screen.queryByTestId('assistant-world-attribution-details')).toBeNull()
    // Кнопка раскрытия объявляет своё состояние и меняет подпись.
    const toggle = () => screen.getByTestId('assistant-world-attribution-toggle')
    expect(toggle().props.accessibilityState).toMatchObject({ expanded: false })
    expect(toggle().props.accessibilityLabel).toBe('Об источниках данных')
    await fireEvent.press(toggle())
    expect(toggle().props.accessibilityState).toMatchObject({ expanded: true })
    expect(toggle().props.accessibilityLabel).toBe('Свернуть источники данных')
    const details = screen.getByTestId('assistant-world-attribution-details').props.children as string
    expect(details).toContain('produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved')
    expect(details).toContain('ODbL 1.0')
    expect(details).toContain('NASA Langley Research Center POWER Project')
  })

  it('ссылка на файл слоя ODbL есть, только когда служба отдала его адрес', async () => {
    const first = await render(<Card item={turn()} />)
    expect(screen.queryByTestId('assistant-world-layer')).toBeNull()
    await first.unmount()
    await render(<Card item={turn({ worldLayerUrl: LAYER_URL })} />)
    await fireEvent.press(screen.getByTestId('assistant-world-layer'))
    expect(mockOpenExternal).toHaveBeenCalledWith(LAYER_URL)
  })

  it('без маршрутов мира блока нет: ход выглядит как раньше', async () => {
    await render(<Card item={turn({ world: [] })} />)
    expect(screen.queryByTestId('assistant-world')).toBeNull()
    expect(screen.queryByText('Ещё в мире')).toBeNull()
    expect(screen.getByTestId('assistant-source-travel-505')).toBeTruthy()
  })

  it('на сайте материалов нет — блок остаётся под честным «материалов нет»', async () => {
    await render(<Card item={turn({ status: 'no_sources', answer: '', sources: [] })} />)
    expect(screen.getByText('На сайте пока нет материалов по этому вопросу. Попробуйте другое направление или загляните в каталог маршрутов.')).toBeTruthy()
    expect(screen.getByTestId('assistant-world')).toBeTruthy()
  })

  it('пока ответ пишется, блока ещё нет', async () => {
    await render(<Card item={turn({ status: 'streaming' })} />)
    expect(screen.queryByTestId('assistant-world')).toBeNull()
  })

  it('узкий экран: блок рисуется теми же строками, без карусели', async () => {
    await render(<Card item={turn()} narrow />)
    expect(screen.getAllByTestId(/^assistant-world-trail-/)).toHaveLength(3)
  })
})

describe('useAssistantChat: маршруты мира от службы (#3357)', () => {
  const done: AskResult['done'] = {
    status: 'done',
    reason: null,
    strikes: null,
    strikesToBlock: null,
    removedLinks: 0,
    fallback: false,
    relabeled: 0,
    droppedDescriptions: 0,
    ungroundedNumbers: 0,
    usage: null,
    remaining: null,
    turnId: null,
  }
  const client = (result: Partial<AskResult>): AskClient => ({
    ask: async (request) => {
      const sources = result.sources ?? []
      request.onSources?.({ sources, degraded: false, remaining: 19, ...(result.world ? { world: result.world } : {}), ...(result.worldLayerUrl ? { worldLayerUrl: result.worldLayerUrl } : {}) })
      return { sources, text: result.text ?? '', done: result.done ?? done, ...(result.world ? { world: result.world } : {}), ...(result.worldLayerUrl ? { worldLayerUrl: result.worldLayerUrl } : {}) }
    },
  })

  it('ход получает маршруты мира и адрес слоя; в историю диалога они не идут', async () => {
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client({ sources: [travel], text: `Пройдите [${travel.title}](${travel.url}).`, world: [whw, tmb], worldLayerUrl: LAYER_URL }) }))
    await act(async () => {
      await result.current.ask('Пеший маршрут не более 200 км')
    })
    expect(result.current.turns[0]).toMatchObject({ status: 'done', sources: [travel], world: [whw, tmb], worldLayerUrl: LAYER_URL })
  })

  it('на сайте материалов нет, а маршруты мира есть: статус прежний, блок остаётся', async () => {
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client({ world: [whw], done: { ...done, status: 'no_sources' } }) }))
    await act(async () => {
      await result.current.ask('Пеший маршрут в Великобритании')
    })
    expect(result.current.turns[0]).toMatchObject({ status: 'no_sources', sources: [], world: [whw] })
  })

  it('служба без маршрутов мира: поле хода пусто, блока нет', async () => {
    const { result } = await renderHook(() => useAssistantChat({ locale: 'ru', askClient: client({ sources: [travel], text: 'Ответ.' }) }))
    await act(async () => {
      await result.current.ask('Какие квесты есть в Гродно?')
    })
    expect(result.current.turns[0].world ?? []).toEqual([])
  })
})

describe('блок «Ещё в мире»: подписи на пяти локалях (#3357)', () => {
  const { aiAssistStaticResources: ruKeys } = require('@/i18n/locales/ru/static/ai_assist_static')
  const bundles: Record<string, Record<string, string>> = {
    ru: ruKeys,
    be: require('@/i18n/locales/be/static/ai_assist_static').aiAssistStaticResources,
    uk: require('@/i18n/locales/uk/static/ai_assist_static').aiAssistStaticResources,
    pl: require('@/i18n/locales/pl/static/ai_assist_static').aiAssistStaticResources,
    en: require('@/i18n/locales/en/static/ai_assist_static').aiAssistStaticResources,
  }
  const worldKeys = Object.keys(ruKeys).filter((key) => key.startsWith('ask.world'))

  it('ключи блока есть на каждой локали и несут те же подстановки, что в RU', () => {
    expect(worldKeys.length).toBeGreaterThanOrEqual(24)
    const placeholders = (value: string) => (value.match(/\{\{\w+\}\}/g) ?? []).sort()
    for (const [locale, bundle] of Object.entries(bundles)) {
      for (const key of worldKeys) {
        expect({ locale, key, filled: Boolean(bundle[key]?.trim()) }).toEqual({ locale, key, filled: true })
        expect({ locale, key, placeholders: placeholders(bundle[key]) }).toEqual({ locale, key, placeholders: placeholders(ruKeys[key]) })
      }
    }
  })

  it('строка об источниках на каждой локали называет OpenStreetMap с ODbL, Wikidata, Copernicus DEM и NASA POWER; обязательная строка Copernicus — дословно', () => {
    for (const [locale, bundle] of Object.entries(bundles)) {
      for (const source of ['OpenStreetMap', 'ODbL', 'Wikidata', 'Copernicus DEM', 'NASA POWER']) {
        expect({ locale, source, named: bundle['ask.worldAttribution'].includes(source) }).toEqual({ locale, source, named: true })
      }
      expect(bundle['ask.worldAttributionDetails']).toContain('produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved')
    }
  })
})

it('название месяца берётся у общего форматтера дат — в именительном падеже на всех пяти локалях', () => {
  const { formatDate } = require('@/i18n/format')
  const november = (locale: string) => formatDate(Date.UTC(2024, 10, 15), { month: 'long', timeZone: 'UTC' }, locale)
  expect(['ru', 'be', 'uk', 'pl', 'en'].map(november)).toEqual(['ноябрь', 'лістапад', 'листопад', 'listopad', 'November'])
})
