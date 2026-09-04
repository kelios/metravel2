/**
 * #1764: санитайзер стоит на пути ЗАПИСИ тела статьи, поэтому всё, чего нет в
 * его allowlist, он вычёркивает из хранимого текста, а не из кадра.
 *
 * До ad2fdc9eb (26.07.2026) в allowlist не было `details`/`summary`, и
 * `disallowedTagsMode: 'discard'` оставлял текст вопросов, выбрасывая сами теги
 * — блок «Частые вопросы» превращался в плоские `<strong>`, `extractFaqEntries`
 * переставал видеть в нём вопросы, и FAQPage пропадал из выдачи. Так статьи 554
 * и 134 потеряли разметку между 05.07 и 25.07.2026, молча.
 *
 * Тест держит инвариант с обеих сторон: сегодняшний санитайзер FAQ пропускает,
 * а санитайзер, который его схлопывает, останавливает сохранение ДО запроса —
 * на обоих контрактах записи.
 */
import { saveFormData, saveTravelContent } from '@/api/misc'
import { translate as i18nT } from '@/i18n'
import type { TravelFormData } from '@/types/types'

/** Включает поведение allowlist'а до 26.07.2026: disclosure-теги снимаются. */
let mockFlattenDisclosureTags = false
/** Моделирует уход `section`/`class` из allowlist: обёртка снята, пары целы. */
let mockDropFaqSection = false

const mockGetSecureItem = jest.fn()
const mockApiClientRequest = jest.fn()

jest.mock('@/utils/secureStorage', () => ({
  getSecureItem: (...args: any[]) => mockGetSecureItem(...args),
}))

jest.mock('@/utils/authPlatform', () => ({
  usesWebCookieAuth: () => false,
  shouldUseStoredAuthToken: () => true,
  hasUsableAuthCredential: (token: string | null) => Boolean(token),
  getApiRequestCredentials: () => ({}),
  ACCESS_TOKEN_STORAGE_KEY: 'access_token',
}))

jest.mock('@/api/client', () => ({
  apiClient: {
    request: (...args: any[]) => mockApiClientRequest(...args),
  },
  ApiError: class ApiError extends Error {},
}))

// Настоящий санитайзер — источник истины для «сегодня FAQ проходит»; регрессия
// allowlist'а моделируется поверх него, а не вместо него.
jest.mock('@/utils/sanitizeRichText', () => {
  const actual = jest.requireActual('@/utils/sanitizeRichText')
  return {
    ...actual,
    sanitizeRichText: (html?: string | null) => {
      let clean = actual.sanitizeRichText(html)
      if (mockFlattenDisclosureTags) clean = clean.replace(/<\/?(details|summary)\b[^>]*>/gi, '')
      if (mockDropFaqSection) clean = clean.replace(/<\/?section\b[^>]*>/gi, '')
      return clean
    },
  }
})

const FAQ_BODY = [
  '<p>Вступление статьи.</p>',
  '<section class="seo-faq" data-faq="metravel-seo" itemscope itemtype="https://schema.org/FAQPage">',
  '<h2>Частые вопросы</h2>',
  '<details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">',
  '<summary itemprop="name"><strong>Как доехать без машины?</strong></summary>',
  '<div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer"><div itemprop="text">',
  '<p>Поездом до Катовице, дальше автобусом.</p>',
  '</div></div>',
  '</details>',
  '</section>',
].join('\n')

const baseForm = ({
  id: 554,
  name: 'Озеро Попроцаны',
  description: FAQ_BODY,
  year: '2026',
  categories: [20],
  countries: [160],
  coordsMeTravel: [],
  gallery: [],
  travelAddress: [],
  publish: true,
  moderation: true,
} as unknown) as TravelFormData

const guardMessage = () => i18nT('errorsStatic:api.misc.faqMarkupWouldBeLost')

const writtenDescription = () => {
  const [, options] = mockApiClientRequest.mock.calls[0]
  return JSON.parse(options.body).description as string
}

describe('запись тела статьи не теряет FAQ-разметку (#1764)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFlattenDisclosureTags = false
    mockDropFaqSection = false
    mockGetSecureItem.mockResolvedValue('token')
    mockApiClientRequest.mockResolvedValue({ ...baseForm })
  })

  describe('PUT /travels/upsert/', () => {
    it('пропускает блок «Частые вопросы» через сегодняшний санитайзер', async () => {
      await saveFormData(baseForm)

      const description = writtenDescription()
      expect(description).toContain('<details')
      expect(description).toContain('<summary')
      expect(description).toContain('seo-faq')
    })

    it('останавливает сохранение, если санитайзер схлопнул disclosure-разметку', async () => {
      mockFlattenDisclosureTags = true

      await expect(saveFormData(baseForm)).rejects.toThrow(guardMessage())
      expect(mockApiClientRequest).not.toHaveBeenCalled()
    })

    // Микроразметку `itemprop="mainEntity"` санитайзер снимает всегда, поэтому
    // без обёртки генератор перестаёт узнавать в блоке FAQ — при неизменном
    // числе пар `<details>/<summary>`. Счёт одних пар такую запись пропустил бы.
    it('останавливает сохранение, если снята секция-обёртка, а пары целы', async () => {
      mockDropFaqSection = true

      await expect(saveFormData(baseForm)).rejects.toThrow(guardMessage())
      expect(mockApiClientRequest).not.toHaveBeenCalled()
    })

    it('не мешает сохранять тело без FAQ-блока', async () => {
      mockFlattenDisclosureTags = true

      await saveFormData({ ...baseForm, description: '<p>Просто текст.</p>' })

      expect(writtenDescription()).toContain('Просто текст')
    })
  })

  describe('PATCH /travels/{id}/content/', () => {
    beforeEach(() => {
      mockApiClientRequest.mockResolvedValue({
        id: 554,
        slug: 'ozero-poprocany',
        name: 'Озеро Попроцаны',
        description: FAQ_BODY,
        plus: null,
        minus: null,
        recommendation: null,
        changed_fields: ['description'],
        updated_at: '2026-09-04T12:00:00Z',
      })
    })

    it('пропускает блок «Частые вопросы» через сегодняшний санитайзер', async () => {
      await saveTravelContent(554, { description: FAQ_BODY })

      const description = writtenDescription()
      expect(description).toContain('<details')
      expect(description).toContain('<summary')
    })

    it('останавливает сохранение, если санитайзер схлопнул disclosure-разметку', async () => {
      mockFlattenDisclosureTags = true

      await expect(saveTravelContent(554, { description: FAQ_BODY })).rejects.toThrow(guardMessage())
      expect(mockApiClientRequest).not.toHaveBeenCalled()
    })
  })
})
