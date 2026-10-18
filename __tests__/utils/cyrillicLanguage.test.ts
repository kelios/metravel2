import { cyrillicLanguageSegments, cyrillicRunLanguages, quotedCyrillicSegments } from '@/utils/cyrillicLanguage'

// Real quotes from the PL/EN quest translations on prod, 18.10.2026 (#2472).
const marked = (run: string, countryCode?: string) =>
  cyrillicRunLanguages(run, { countryCode })
    .filter((part) => part.lang)
    .map((part) => `${part.text}=${part.lang}`)

describe('cyrillicRunLanguages (#2472)', () => {
  it('takes a letter only one language has', () => {
    expect(marked('Лесвіца ў Падміколле', 'by')).toEqual(['Лесвіца ў Падміколле=be'])
    expect(marked('Львівська копальня кави', 'ua')).toEqual(['Львівська копальня кави=uk'])
    expect(marked('Раздолъ', 'by')).toEqual(['Раздолъ=ru'])
  })

  it('keeps the source language for letters Russian and Belarusian share in Belarus', () => {
    expect(marked('Лесные озёра', 'BY')).toEqual(['Лесные озёра=ru'])
    expect(marked('Ландыш', 'BY')).toEqual(['Ландыш=ru'])
    expect(marked('я з Пінска', 'BY')).toEqual(['я з Пінска=be'])
  })

  it('prefers the language of the country when letters fit several', () => {
    expect(marked('Копальня кави', 'UA')).toEqual(['Копальня кави=uk'])
    expect(marked('Копальня кави')).toEqual(['Копальня кави=ru'])
  })

  it('splits a run no plausible language spells by word', () => {
    expect(marked('Капліца-пахавальня Святополк-Мирских', 'BY'))
      .toEqual(['Капліца-пахавальня=be', 'Святополк-Мирских=ru'])
  })

  it('recognizes Cyrillic alphabets beyond the three site languages', () => {
    expect(marked('ҰЛТТЫҚ МҰРАҒАТЫ', 'KZ')).toEqual(['ҰЛТТЫҚ МҰРАҒАТЫ=kk'])
    expect(marked('Кнез Михаилова', 'RS')).toEqual(['Кнез Михаилова=sr'])
    expect(marked('Љубљана')).toEqual(['Љубљана=sr'])
  })
})

describe('cyrillicLanguageSegments', () => {
  it('keeps the surrounding Latin text and punctuation verbatim', () => {
    const segments = cyrillicLanguageSegments('Kawiarnia «Ландыш», ul. Ленина 5', { countryCode: 'BY' })
    expect(segments).toEqual([
      { text: 'Kawiarnia «', lang: null },
      { text: 'Ландыш', lang: 'ru' },
      { text: '», ul. ', lang: null },
      { text: 'Ленина', lang: 'ru' },
      { text: ' 5', lang: null },
    ])
    expect(segments.map((s) => s.text).join('')).toBe('Kawiarnia «Ландыш», ul. Ленина 5')
  })

  it('returns plain text untouched', () => {
    expect(cyrillicLanguageSegments('Old Town')).toEqual([{ text: 'Old Town', lang: null }])
    expect(cyrillicLanguageSegments('')).toEqual([])
  })
})

describe('quotedCyrillicSegments (#2473)', () => {
  it('marks quotes only in Latin-script content locales', () => {
    expect(quotedCyrillicSegments('Kawiarnia «Ландыш»', { contentLocale: 'pl', countryCode: 'by' })).toEqual([
      { text: 'Kawiarnia «', lang: null },
      { text: 'Ландыш', lang: 'ru' },
      { text: '»', lang: null },
    ])
    expect(quotedCyrillicSegments('Кавярня «Ландыш»', { contentLocale: 'be', countryCode: 'by' })).toBeNull()
    expect(quotedCyrillicSegments('Кафе «Ландыш»', { contentLocale: undefined, countryCode: 'by' })).toBeNull()
  })

  it('leaves text without Cyrillic alone', () => {
    expect(quotedCyrillicSegments('Brama Floriańska', { contentLocale: 'en' })).toBeNull()
    expect(quotedCyrillicSegments(undefined, { contentLocale: 'en' })).toBeNull()
  })
})
