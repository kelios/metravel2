import i18n from '@/i18n/instance'
import { resources } from '@/i18n/resources'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import { getQuestFaqItems } from '@/screens/tabs/QuestsSeoIntroFaq'

afterEach(async () => { await i18n.changeLanguage('ru') })

describe('quest offline FAQ (#3063)', () => {
  it.each(SUPPORTED_LOCALES)('chooses the web restriction and preserves native copy in %s', async (locale) => {
    await i18n.changeLanguage(locale)
    expect(getQuestFaqItems('web')[5].a).toBe(resources[locale].quests['screens.tabs.QuestsSeoIntroFaq.a6Web'])
    expect(getQuestFaqItems('ios')[5].a).toBe(resources[locale].quests['screens.tabs.QuestsSeoIntroFaq.a6'])
  })
})
