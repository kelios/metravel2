import fs from 'node:fs'
import path from 'node:path'

import {
  ACTION_CONSENT_STORAGE_KEY,
  QUEST_START_CONSENT,
  buildActionConsentStore,
} from '../../e2e/helpers/actionConsent'
import { ACTION_CONSENT_KEY, CONSENT_TYPES, hasActionConsent } from '@/utils/actionConsent'

/**
 * #2151: perf-гейт QUEST_DETAIL месяцами ждал селектор визарда, потому что спек
 * не сеял согласие quest_start, а страница стояла на QuestConsentGate. Сид
 * согласия в e2e живёт в одном хелпере; здесь он держится в паре с продуктом —
 * смена ключа или версии согласия краснеет тут, а не таймаутом в e2e.
 */

const E2E_DIR = path.resolve(__dirname, '../../e2e')
const HELPER = path.join(E2E_DIR, 'helpers', 'actionConsent.ts')

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listSources(full)
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [full] : []
  })

describe('e2e action consent seed (#2151)', () => {
  it('writes the storage key the product reads', () => {
    expect(ACTION_CONSENT_STORAGE_KEY).toBe(ACTION_CONSENT_KEY)
  })

  it('the seeded store passes the product quest_start check', () => {
    expect(QUEST_START_CONSENT.type).toBe(CONSENT_TYPES.QUEST_START)
    const store = JSON.parse(buildActionConsentStore())
    expect(hasActionConsent(store, CONSENT_TYPES.QUEST_START)).toBe(true)
  })

  it('no e2e file writes the consent store by hand', () => {
    const offenders = listSources(E2E_DIR)
      .filter((file) => file !== HELPER)
      .filter((file) => fs.readFileSync(file, 'utf8').includes(ACTION_CONSENT_KEY))
      .map((file) => path.relative(E2E_DIR, file))
    expect(offenders).toEqual([])
  })
})
