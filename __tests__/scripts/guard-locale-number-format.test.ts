/**
 * #1459: четыре карточки подряд (#1433, #1440, #1449, #1457) чинили один и тот
 * же корень — число печаталось по-английски мимо `i18n/format.ts` — каждая в
 * своём наборе файлов. Тест держит сам guard: он обязан видеть отображаемое
 * `toFixed` и ручной суффикс, молчать на координатах и ключах кэша, а его
 * allowlist не должен расти молча.
 */
const path = require('node:path')

const { makeTempDir, removeDir, runNodeCli, writeTextFile } = require('./cli-test-utils')

const {
  ALLOWLIST,
  MAX_ALLOWLIST_ENTRIES,
  MAX_DISPLAY_FRACTION_DIGITS,
  evaluateFindings,
  scanFile,
  scanLocaleNumberFormat,
} = require('@/scripts/guard-locale-number-format')

const component = (body: string) => `
  import { Text, View } from 'react-native'
  import { translate as i18nT } from '@/i18n'

  export const Probe = ({ rating, count, lat, lng }: any) => {
    ${body}
  }
`

const findingKeys = (content: string, filePath = 'components/Probe.tsx') =>
  scanFile({ filePath, content }).findings.map((finding: { key: string }) => finding.key)

describe('guard-locale-number-format', () => {
  it('видит семейство #1433/#1440/#1449/#1457: отображаемое toFixed прямо в JSX', () => {
    const result = scanFile({
      filePath: 'components/Probe.tsx',
      content: component('return <Text>{rating.toFixed(1)}</Text>'),
    })

    expect(result.findings).toEqual([
      expect.objectContaining({
        key: 'components/Probe.tsx::Probe::display-toFixed',
        reason: 'display-toFixed',
        detail: 'jsx-text',
      }),
    ])
  })

  it('видит toFixed через одну связку: переменную, функцию-форматтер и аргумент перевода', () => {
    const viaVariable = component(`
      const label = rating.toFixed(1)
      return <Text>{label}</Text>
    `)
    const viaFormatter = component(`
      const formatRating = (value: number) => value.toFixed(1)
      return <Text>{formatRating(rating)}</Text>
    `)
    const viaTranslationArgument = component(`
      return <Text>{i18nT('shared:probe', { value1: rating.toFixed(1) })}</Text>
    `)
    const viaDisplayProp = component(`
      const badges = [rating.toFixed(1)]
      return <View badges={badges} />
    `)

    expect(findingKeys(viaVariable)).toEqual(['components/Probe.tsx::label::display-toFixed'])
    expect(findingKeys(viaFormatter)).toEqual(['components/Probe.tsx::formatRating::display-toFixed'])
    // Внутри аргумента перевода ближайшая связка — сам параметр подстановки.
    expect(findingKeys(viaTranslationArgument)).toEqual(['components/Probe.tsx::value1::display-toFixed'])
    expect(findingKeys(viaDisplayProp)).toEqual(['components/Probe.tsx::badges::display-toFixed'])
  })

  it('видит ручной суффикс единицы даже вне отображаемой позиции и без toFixed', () => {
    const compactSuffix = component("const compact = (count / 1000).toFixed(1) + 'K'; return <View />")
    const templateSuffix = component('const size = `${(count / 1024).toFixed(1)} KB`; return <View />')
    const russianUnit = component('const trip = `${count.toFixed(1)} км`; return <View />')
    const roundedUnit = component('const trip = `${Math.round(count)} км`; return <View />')

    expect(findingKeys(compactSuffix)).toEqual(['components/Probe.tsx::compact::manual-unit-suffix'])
    expect(findingKeys(templateSuffix)).toEqual(['components/Probe.tsx::size::manual-unit-suffix'])
    expect(findingKeys(russianUnit)).toEqual(['components/Probe.tsx::trip::manual-unit-suffix'])
    expect(findingKeys(roundedUnit)).toEqual(['components/Probe.tsx::trip::manual-unit-suffix'])
  })

  it('видит склейку через промежуточную переменную и молчит на ISO-8601', () => {
    const twoHops = component(`
      const raw = rating.toFixed(1)
      const label = \`★ \${raw}\`
      return <Text>{label}</Text>
    `)
    const isoDuration = component('const timeRequired = `PT${Math.round(count)}M`; return <View />')

    expect(findingKeys(twoHops)).toEqual(['components/Probe.tsx::raw::display-toFixed'])
    expect(findingKeys(isoDuration)).toEqual([])
  })

  it('молчит на координатах, ключах кэша, точности выше отображаемой и машинных пропсах', () => {
    const coordinates = component('return <Text>{lat.toFixed(1)}, {lng.toFixed(1)}</Text>')
    const cacheKey = component('const key = `r:${count.toFixed(0)}`; return <View testID={key} />')
    const precision = component(`return <Text>{rating.toFixed(${MAX_DISPLAY_FRACTION_DIGITS + 1})}</Text>`)
    const machineProp = component('const points = [count.toFixed(2)]; return <View points={points} />')
    const timing = component('const log = `${count.toFixed(0)}ms`; return <View />')

    expect(findingKeys(coordinates)).toEqual([])
    expect(findingKeys(cacheKey)).toEqual([])
    expect(findingKeys(precision)).toEqual([])
    expect(findingKeys(machineProp)).toEqual([])
    expect(findingKeys(timing)).toEqual([])
  })

  it('принимает канонический форматтер как исправление тех же call-site', () => {
    const fixed = `
      import { Text } from 'react-native'
      import { formatNumber } from '@/i18n/format'
      import { formatRatingValue } from '@/utils/ratingHelpers'

      export const Probe = ({ rating, distanceKm }: any) => (
        <Text>{formatRatingValue(rating)} {formatNumber(distanceKm, { maximumFractionDigits: 1 })}</Text>
      )
    `

    expect(findingKeys(fixed)).toEqual([])
  })

  it('отклоняет пустой скан, раздутый и протухший allowlist', () => {
    const finding = {
      key: 'components/Probe.tsx::label::display-toFixed',
      file: 'components/Probe.tsx',
      line: 1,
      binding: 'label',
      reason: 'display-toFixed',
      detail: 'via label',
    }
    const base = { files: 1, toFixedCount: 1, displayNameCount: 2, findings: [finding] }
    const oversized = Object.fromEntries(
      Array.from({ length: MAX_ALLOWLIST_ENTRIES + 1 }, (_, index) => [`entry-${index}`, 'reason']),
    )

    expect(evaluateFindings({ ...base, allowlist: { [finding.key]: 'reviewed' } }).ok).toBe(true)
    expect(evaluateFindings({ ...base, allowlist: { stale: 'old entry' } }).staleAllowlist).toEqual(['stale'])
    expect(evaluateFindings({ ...base, allowlist: oversized }).allowlistTooLarge).toBe(true)
    expect(
      evaluateFindings({ files: 0, toFixedCount: 0, displayNameCount: 0, findings: [], allowlist: {} }).vacuous,
    ).toBe(true)
  })

  it('держит рейтинг из #1459 разобранным: правка чинит, откат снова падает', () => {
    const filePath = 'components/ui/StarRating.tsx'
    const fs = require('node:fs')
    const afterSource = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
    const beforeSource = afterSource.replace(
      'return formatRatingValue(value);',
      'return value.toFixed(1);',
    )

    expect(beforeSource).not.toBe(afterSource)
    expect(scanFile({ filePath, content: beforeSource }).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: `${filePath}::formatRating::display-toFixed` }),
      ]),
    )
    expect(scanFile({ filePath, content: afterSource }).findings).toEqual([])
  })

  it('оставляет скан чистого дерева непустым и без нарушений', () => {
    const result = scanLocaleNumberFormat(process.cwd())

    expect(result.fileCount).toBeGreaterThan(100)
    expect(result.toFixedCount).toBeGreaterThan(0)
    expect(result.displayNameCount).toBeGreaterThan(0)
    expect(result.allowlistedCount).toBe(Object.keys(ALLOWLIST).length)
    expect(result.staleAllowlist).toEqual([])
    expect(result.violations).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('держит --json машиночитаемым и возвращает ненулевой код на нарушении', () => {
    const rootDir = makeTempDir('guard-locale-number-format-')
    try {
      writeTextFile(
        path.join(rootDir, 'components', 'Probe.tsx'),
        component("const compact = (count / 1000).toFixed(1) + 'K'; return <Text>{compact}</Text>"),
      )

      const result = runNodeCli([
        path.resolve(process.cwd(), 'scripts/guard-locale-number-format.js'),
        '--root',
        rootDir,
        '--json',
      ])
      const payload = JSON.parse(result.stdout)

      expect(result.status).toBe(1)
      expect(result.stderr).toBe('')
      expect(payload).toMatchObject({ ok: false, vacuous: false, violationCount: 1 })
    } finally {
      removeDir(rootDir)
    }
  })
})
