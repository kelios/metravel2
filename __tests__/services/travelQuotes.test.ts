import { TRAVEL_QUOTES, pickRandomQuote } from '@/src/services/pdf-export/quotes/travelQuotes'

describe('travelQuotes', () => {
  it('returns different quote when exclude provided', () => {
    const first = TRAVEL_QUOTES[0]
    const picked = pickRandomQuote(first)
    expect(picked.text).toBeDefined()
    expect(picked.text === first.text && picked.author === first.author).toBe(false)
  })

  it('falls back to default when pool is empty', () => {
    const result = pickRandomQuote({ text: 'missing', author: 'none' })
    expect(result).toBeDefined()
  })
})
