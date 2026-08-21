import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config'
import { resources } from '@/i18n/resources'
import { EMAIL_SUBSCRIPTION_CONSENT } from '@/utils/actionConsent'

const CONSENT_LABELS_BY_VERSION: Record<string, Record<SupportedLocale, string>> = {
  'email-subscribe-2026-08-20-v1': {
    ru: 'Даю согласие на обработку email для рассылки маршрутов и квестов.',
    be: 'Даю згоду на апрацоўку email для рассылкі маршрутаў і квэстаў.',
    uk: 'Даю згоду на обробку email для розсилки маршрутів і квестів.',
    pl: 'Wyrażam zgodę na przetwarzanie mojego adresu e-mail w celu wysyłki tras i questów.',
    en: 'I agree to my email being processed for the routes and quests newsletter.',
  },
}

describe('email subscription consent wording version', () => {
  it('binds one explicit version to the exact RU/BE/UK/PL/EN wording bundle', () => {
    expect(EMAIL_SUBSCRIPTION_CONSENT.labelKey).toBe(
      'sharedStatic:subscription.consentLabel',
    )

    const currentLabels = Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [
        locale,
        resources[locale].sharedStatic['subscription.consentLabel'],
      ]),
    )

    expect(currentLabels).toEqual(
      CONSENT_LABELS_BY_VERSION[EMAIL_SUBSCRIPTION_CONSENT.version],
    )
  })
})
