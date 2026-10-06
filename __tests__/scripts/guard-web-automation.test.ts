import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, removeDir } from './cli-test-utils'

const { findViolations, collectViolations } = require('../../scripts/guard-web-automation')

it.each(['navigator.webdriver', "navigator['webdriver']", "navigator['web' + 'driver']", "const key = 'webdriver'; navigator[key]", "Reflect.get(navigator, 'webdriver')", 'const { webdriver: automated } = navigator'] )('rejects a new raw automation copy: %s', (source) => {
  expect(findViolations(source, 'hooks/copy.ts')).toEqual([expect.objectContaining({ rule: 'noncanonical-webdriver-read' })])
})

it('permits only the two canonical detectors and ignores comments/declarations', () => {
  for (const file of ['utils/isWebAutomation.ts', 'utils/analyticsInlineScript.ts']) expect(findViolations('navigator.webdriver', file)).toEqual([])
  expect(findViolations("// navigator.webdriver\n type Nav = { webdriver?: boolean }; const label = 'navigator.webdriver';", 'hooks/normal.ts')).toEqual([])
})

it.each(['window.gtag', "window['dataLayer']", 'window.__e2eAnalyticsEvents', 'window.__metravelAnalyticsEventQueue', 'window.__metravelAnalyticsIntents', "Object.defineProperty(window, 'gtag', { value: recorder })", 'const { gtag: recorder } = window'] )('rejects analytics observation outside the helper: %s', (source) => {
  expect(findViolations(source, 'e2e/quest-return-loop.spec.ts')).toEqual([expect.objectContaining({ rule: 'analytics-observation-outside-helper' })])
  expect(findViolations(source, 'e2e/helpers/analytics.ts')).toEqual([])
})

it('enforces an empty baseline over real files, with no suppression list', () => {
  const root = makeTempDir('automation-guard-')
  try {
    fs.mkdirSync(path.join(root, 'hooks'))
    fs.writeFileSync(path.join(root, 'hooks', 'valid.ts'), "import { isWebAutomationNavigator } from '@/utils/isWebAutomation'; isWebAutomationNavigator(navigator)")
    expect(collectViolations(root)).toEqual([])
    fs.writeFileSync(path.join(root, 'hooks', 'copy.ts'), 'Boolean(navigator.webdriver)')
    expect(collectViolations(root)).toEqual([expect.objectContaining({ file: 'hooks/copy.ts' })])
  } finally { removeDir(root) }
})
