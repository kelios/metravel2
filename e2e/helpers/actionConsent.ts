import type { Page } from '@playwright/test'

// Сид «действенных» согласий (квест и т.п.) для e2e — единственное место ключа и
// версий в e2e (#2151). Продуктовый `utils/actionConsent.ts` тянет react-native и
// AsyncStorage и в процесс Playwright не грузится, поэтому здесь зеркало;
// `__tests__/e2e-helpers/actionConsent.test.ts` держит его в паре с продуктом:
// засеянное хранилище обязано проходить `hasActionConsent`. Без согласия
// страница квеста стоит на `QuestConsentGate`, и тест молча ждёт селектор
// визарда до таймаута.

export const ACTION_CONSENT_STORAGE_KEY = 'metravel_action_consents_v1'

export type ActionConsentSeed = { readonly type: string; readonly version: string }

export const QUEST_START_CONSENT: ActionConsentSeed = Object.freeze({ type: 'quest_start', version: '1' })

export const buildActionConsentStore = (
  consents: readonly ActionConsentSeed[] = [QUEST_START_CONSENT],
  date: string = new Date().toISOString(),
): string =>
  JSON.stringify(Object.fromEntries(consents.map(({ type, version }) => [type, { version, date }])))

/** Кладёт согласия в localStorage до загрузки страницы (и при каждой навигации). */
export async function seedActionConsents(
  page: Page,
  consents: readonly ActionConsentSeed[] = [QUEST_START_CONSENT],
): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // ignore
      }
    },
    { key: ACTION_CONSENT_STORAGE_KEY, value: buildActionConsentStore(consents) },
  )
}
