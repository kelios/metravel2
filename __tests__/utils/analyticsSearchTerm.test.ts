import { isAnalyticsSearchTerm } from '@/utils/analyticsSearchTerm'

describe('isAnalyticsSearchTerm — PII-фильтр search_term (#3447, #3469)', () => {
  it.each([
    'минск',
    'кракаў',
    'минск 1941-1945',
    'брест 1941 – 1945',
    'фестиваль 2025 2026',
    'гродно 1939',
    'маршрут 12 км',
  ])('пропускает обычный запрос «%s»', (term) => {
    expect(isAnalyticsSearchTerm(term)).toBe(true)
  })

  it.each([
    '',
    'м',
    'a'.repeat(101),
    'julia@example.com',
    'https://example.com',
    'www.example.com',
    '+48 (123) 456-789',
    '1234567',
    '8029 123-45-67',
    'минск +375 29 123 45 67',
    'гид 375291234567',
    'брест 1941 тел 123-45-67',
    '1999-2001 1234567',
    '+1941 1945',
  ])('отсекает «%s»', (term) => {
    expect(isAnalyticsSearchTerm(term)).toBe(false)
  })
})
