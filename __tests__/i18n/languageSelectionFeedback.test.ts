import { i18n } from '@/i18n'
import { showLocaleSelectionError, showProfileLanguageSyncError } from '@/i18n/languageSelectionFeedback'
import { resources } from '@/i18n/resources'
import { showToast } from '@/utils/toast'

jest.mock('@/utils/toast', () => ({ showToast: jest.fn(async () => undefined) }))

beforeEach(async () => {
  jest.mocked(showToast).mockReset().mockResolvedValue(undefined)
  await i18n.changeLanguage('ru')
})

afterEach(async () => {
  await i18n.changeLanguage('ru')
})

it.each(['ru', 'be', 'uk', 'pl', 'en'] as const)('shows an unsaved profile language error in the current %s UI locale', async (locale) => {
  // The module was already imported in RU; translate at emission time instead.
  await i18n.changeLanguage(locale)
  showProfileLanguageSyncError()
  expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
    type: 'error',
    text1: resources[locale].common['language.syncErrorTitle'],
    text2: resources[locale].common['language.syncErrorDescription'],
  }))
})

it('uses existing generic feedback for a rejected local selection', async () => {
  await i18n.changeLanguage('en')
  showLocaleSelectionError()
  expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
    type: 'error', text1: 'Could not complete the action',
  }))
})

it('handles a toast-host rejection without creating another unhandled failure', async () => {
  jest.mocked(showToast).mockRejectedValue(new Error('toast host unavailable'))
  expect(showProfileLanguageSyncError()).toBeUndefined()
  expect(showLocaleSelectionError()).toBeUndefined()
  await Promise.resolve()
})
