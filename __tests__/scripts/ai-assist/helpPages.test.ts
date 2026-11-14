/**
 * Названия страниц для ссылки справочного ответа (#3369): таблица службы сверяется с навигацией сайта и
 * с адресами корпуса справки.
 */
import fs from 'node:fs'
import path from 'node:path'

import { helpAnswerText } from '@/scripts/ai-assist/ask'
import { HELP_PAGE_KEYS, HELP_PAGE_TITLES, HELP_PAGES_WITHOUT_TITLE, helpPageTitle } from '@/scripts/ai-assist/helpPages'
import { LOCALES } from '@/scripts/ai-assist/search'

const root = path.resolve(__dirname, '../../..')
const navigation = (locale: string): Record<string, string> => {
  const text = fs.readFileSync(path.join(root, 'i18n/locales', locale, 'static/navigation_static.ts'), 'utf8')
  return Object.fromEntries(Array.from(text.matchAll(/"(breadcrumb\.[A-Za-z]+)": "([^"]*)"/g), (match) => [match[1], match[2]]))
}
/** Адреса страниц корпуса: их несёт русский файл, переводы — только тексты. */
const corpusUrls = (): string[] => {
  const entries = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ai-index/sources/help/help.ru.json'), 'utf8')) as Array<{ url: string }>
  return [...new Set(entries.map((entry) => entry.url))]
}

describe('справка: названия страниц для ссылки ответа (#3369)', () => {
  it('название страницы — слово навигации сайта на всех пяти локалях', () => {
    for (const locale of LOCALES) {
      const resources = navigation(locale)
      for (const key of Object.values(HELP_PAGE_KEYS)) expect({ key, locale, title: HELP_PAGE_TITLES[key]?.[locale] }).toEqual({ key, locale, title: resources[key] })
    }
  })

  it('у каждого адреса корпуса справки есть название либо он записан как страница без названия', () => {
    const urls = corpusUrls()
    expect(urls.length).toBeGreaterThan(10)
    for (const url of urls) expect([url, url in HELP_PAGE_KEYS || HELP_PAGES_WITHOUT_TITLE.includes(url)]).toEqual([url, true])
  })

  it('ссылка ответа подписана названием страницы на языке ответа; без названия — адресом', () => {
    expect(helpPageTitle('https://metravel.by/quests', 'pl')).toBe('Questy')
    expect(helpPageTitle('https://metravel.by/quests/', 'be')).toBe('Квэсты')
    expect(helpPageTitle('https://metravel.by/quests/scenario', 'ru')).toBeNull()
    expect(helpPageTitle('не адрес', 'ru')).toBeNull()

    const card = { snippet: 'Бесплатно. Покупать ничего не нужно.', url: 'https://metravel.by/quests' }
    expect(helpAnswerText([card], 'ru')).toBe('Бесплатно. Покупать ничего не нужно.\n\n[Квесты](https://metravel.by/quests)')
    expect(helpAnswerText([{ ...card, snippet: 'Free.' }], 'en')).toBe('Free.\n\n[Quests](https://metravel.by/quests)')
    // Две записи об одной странице — одна ссылка, после второй.
    expect(helpAnswerText([card, { snippet: 'Регистрация не нужна.', url: card.url }], 'ru')).toBe(
      'Бесплатно. Покупать ничего не нужно.\n\nРегистрация не нужна.\n\n[Квесты](https://metravel.by/quests)',
    )
    const scenario = { snippet: 'Сценарий приходит на почту.', url: 'https://metravel.by/quests/scenario' }
    expect(helpAnswerText([scenario], 'ru')).toBe('Сценарий приходит на почту.\n\n[metravel.by/quests/scenario](https://metravel.by/quests/scenario)')
  })
})
