import fs from 'node:fs'
import path from 'node:path'

/**
 * #2162: e2e находят cookie-баннер и его кнопки только по testID через
 * `e2e/helpers/consentBanner.ts`. Локальные копии `maybeAcceptCookies` искали
 * кнопки по русскому копирайту: смена текста (#2135) молча убила часть
 * кандидатов, а копия в global-setup не нажимала ничего.
 */
const E2E_DIR = path.resolve(__dirname, '../../e2e')
const HELPER = path.join(E2E_DIR, 'helpers', 'consentBanner.ts')

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\b(?:function|const|let)\s+maybeAcceptCookies\b/, 'локальная копия maybeAcceptCookies'],
  [/Принять всё|Только необходимые|Мы ценим вашу приватность|Используем аналитику/, 'текст несуществующих кнопок/заголовка баннера'],
  [/getByText\(\s*['"](?:Принять|Отклонить)['"]/, 'кнопка баннера по тексту'],
  [/getByRole\(\s*['"]button['"]\s*,\s*\{\s*name:\s*\/принять\/i/, 'кнопка баннера по роли и тексту'],
]

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listSources(full)
    return /\.(ts|js|mjs)$/.test(entry.name) ? [full] : []
  })

describe('e2e cookie-banner locators (#2162)', () => {
  it('address the banner only through e2e/helpers/consentBanner.ts', () => {
    const violations = listSources(E2E_DIR)
      .filter((file) => file !== HELPER)
      .flatMap((file) => {
        const source = fs.readFileSync(file, 'utf8')
        return FORBIDDEN.filter(([pattern]) => pattern.test(source)).map(
          ([, reason]) => `${path.relative(E2E_DIR, file)}: ${reason}`,
        )
      })

    expect(violations).toEqual([])
  })

  it('uses testIDs the banner actually declares', () => {
    const helper = fs.readFileSync(HELPER, 'utf8')
    const banner = fs.readFileSync(path.resolve(__dirname, '../../components/layout/ConsentBanner.tsx'), 'utf8')

    for (const testID of ['consent-banner', 'consent-accept', 'consent-decline']) {
      expect({ testID, inHelper: helper.includes(`'${testID}'`) }).toEqual({ testID, inHelper: true })
      expect({ testID, inBanner: banner.includes(`testID="${testID}"`) }).toEqual({ testID, inBanner: true })
    }
  })
})
