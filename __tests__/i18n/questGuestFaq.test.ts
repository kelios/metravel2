import path from 'node:path'
import { spawnSync } from 'node:child_process'

import i18n from '@/i18n/instance'
import { resources } from '@/i18n/resources'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import { formatInteger } from '@/i18n/format'
import { getQuestFaqItems } from '@/screens/tabs/QuestsSeoIntroFaq'
import { GUEST_QUEST_FREE_STEPS as progressLimit } from '@/utils/guestQuestProgress'

const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin')
const { createSsgTranslator } = require('@/scripts/lib/questLocalePackage')
const catalogs = loadSsgCatalogs(process.cwd()).catalogs
const answerKey = 'screens.tabs.QuestsSeoIntroFaq.a5'

const requiredAccountAction = {
  ru: 'войти или создать бесплатный аккаунт',
  be: 'ўвайсці або стварыць бясплатны акаўнт',
  uk: 'увійти або створити безкоштовний акаунт',
  pl: 'zalogować lub utworzyć bezpłatne konto',
  en: 'sign in or create a free account',
}

afterEach(async () => {
  await i18n.changeLanguage('ru')
  jest.restoreAllMocks()
})

describe('guest quest registration promise', () => {
  it.each(SUPPORTED_LOCALES)('keeps %s app and SSG registration answers truthful and identical', async (locale) => {
    await i18n.changeLanguage(locale)
    const answer = getQuestFaqItems()[4].a
    const template = resources[locale].quests[answerKey]
    const ssg = createSsgTranslator(catalogs, locale)

    expect(template).toContain('{{freeSteps}}')
    expect(answer).toContain(formatInteger(progressLimit, locale))
    expect(answer).toContain(requiredAccountAction[locale])
    expect(answer).not.toContain('{{')
    expect(answer).toBe(ssg.tp(`quests:${answerKey}`, progressLimit, { freeSteps: formatInteger(progressLimit, locale) }))
  })

  it.each([
    [1, '1 точку'], [2, '2 точки'], [5, '5 точек'], [21, '21 точку'],
  ])('derives app copy and grammar from a changed limit %i', (changedLimit, noun) => {
    // The SSR-rendered /quests FAQ (visible block and FAQPage JSON-LD in
    // QuestsScreen) reads the same getQuestFaqItems() as the app (#2766).
    const limits = require('@/utils/guestQuestLimits')
    jest.replaceProperty(limits, 'GUEST_QUEST_FREE_STEPS', changedLimit)

    expect(getQuestFaqItems()[4].a).toContain(`Гость может пройти ${noun} квеста`)
  })

  it.each([
    ['be', 1, '1 пункт'], ['be', 2, '2 пункты'], ['be', 5, '5 пунктаў'],
    ['uk', 1, '1 точку'], ['uk', 2, '2 точки'], ['uk', 5, '5 точок'],
    ['pl', 1, '1 punkt'], ['pl', 2, '2 punkty'], ['pl', 5, '5 punktów'],
    ['en', 1, '1 quest point;'], ['en', 2, '2 quest points;'], ['en', 5, '5 quest points;'],
  ] as const)('selects matching %s app/SSG noun forms for limit %i', async (locale, limit, noun) => {
    await i18n.changeLanguage(locale)
    const limits = require('@/utils/guestQuestLimits')
    jest.replaceProperty(limits, 'GUEST_QUEST_FREE_STEPS', limit)
    const ssg = createSsgTranslator(catalogs, locale)

    expect(getQuestFaqItems()[4].a).toContain(noun)
    expect(getQuestFaqItems()[4].a).toBe(ssg.tp(`quests:${answerKey}`, limit, { freeSteps: formatInteger(limit, locale) }))
  })

  it('loads the shared gate limit in plain Node without native storage dependencies', () => {
    const leaf = path.resolve(process.cwd(), 'utils/guestQuestLimits.js')
    const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(require(process.argv[1]).GUEST_QUEST_FREE_STEPS))', leaf], { encoding: 'utf8' })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(String(progressLimit))
  })
})
