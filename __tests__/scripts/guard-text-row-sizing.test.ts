const fs = require('node:fs')
const path = require('node:path')

const { makeTempDir, removeDir, runNodeCli, writeTextFile } = require('./cli-test-utils')

const {
  ALLOWLIST,
  MAX_ALLOWLIST_ENTRIES,
  evaluateFindings,
  scanFile,
  scanTextRowSizing,
} = require('@/scripts/guard-text-row-sizing')

const fixture = ({
  firstStyle = '',
  secondStyle = '',
  firstProps = '',
  secondProps = '',
  firstContent = "t('first', { value: first })",
  secondContent = "t('second', { value: second })",
  declarations = '',
  wrapped = false,
} = {}) => `
  import { StyleSheet, Text, View } from 'react-native'
  import Feather from '@expo/vector-icons/Feather'
  import { translate as i18nT } from '@/i18n'

  ${declarations}

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    first: { fontSize: 13${firstStyle} },
    second: { fontSize: 13${secondStyle} },
    firstBounds: { maxWidth: 120 },
    secondBounds: { width: 100 },
  })

  export const Probe = () => (
    <View style={styles.row}>
      <Feather name="map-pin" />
      ${wrapped ? '<View style={styles.firstBounds}>' : ''}
      <Text style={styles.first} ${firstProps}>{${firstContent}}</Text>
      ${wrapped ? '</View>' : ''}
      ${wrapped ? '<View style={styles.secondBounds}>' : ''}
      <Text style={styles.second} ${secondProps}>{${secondContent}}</Text>
      ${wrapped ? '</View>' : ''}
    </View>
  )
`

describe('guard-text-row-sizing', () => {
  it('catches the historical #1342 shape: competing dynamic labels in a wrapping row', () => {
    const result = scanFile({ filePath: 'components/Probe.tsx', content: fixture() })

    expect(result.rowCount).toBe(1)
    expect(result.dynamicTextCount).toBe(2)
    expect(result.findings).toEqual([
      expect.objectContaining({ key: 'components/Probe.tsx::row::first' }),
      expect.objectContaining({ key: 'components/Probe.tsx::row::second' }),
    ])
  })

  it('accepts one flex outlet and rejects standalone flexShrink or competing flex labels', () => {
    const flexWithBoundedSibling = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ firstStyle: ', maxWidth: 120', secondStyle: ', flex: 1' }),
    })
    const flexWithIntrinsicSibling = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ secondStyle: ', flex: 1' }),
    })
    const intrinsicBasis = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ firstStyle: ', flexShrink: 1', secondStyle: ', flexShrink: 1' }),
    })
    const competingFlex = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ firstStyle: ', flex: 1', secondStyle: ', flex: 1' }),
    })

    expect(flexWithBoundedSibling.findings).toEqual([])
    expect(flexWithIntrinsicSibling.findings).toEqual([])
    expect(intrinsicBasis.findings).toHaveLength(2)
    expect(competingFlex.findings).toHaveLength(2)
  })

  it('requires the sizing contract in every conditional style branch', () => {
    const conditionalOnly = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture()
        .replace('style={styles.first}', 'style={[styles.first, enabled && styles.optional]}')
        .replace('style={styles.second}', 'style={[styles.second, enabled && styles.optional]}')
        .replace(
          'secondBounds: { width: 100 },',
          'secondBounds: { width: 100 },\n    optional: { flex: 1 },',
        ),
    })
    const safeInBothBranches = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture()
        .replace(
          'style={styles.first}',
          'style={[enabled ? styles.firstOutletEnabled : styles.firstOutletDisabled]}',
        )
        .replace(
          'style={styles.second}',
          'style={[enabled ? styles.secondBoundsEnabled : styles.secondBoundsDisabled]}',
        )
        .replace(
          'secondBounds: { width: 100 },',
          `secondBounds: { width: 100 },
           firstOutletEnabled: { flex: 1 },
           firstOutletDisabled: { flex: 1 },
           secondBoundsEnabled: { maxWidth: 120 },
           secondBoundsDisabled: { maxWidth: 120 },`,
        ),
    })

    expect(conditionalOnly.findings).toHaveLength(2)
    expect(safeInBothBranches.findings).toEqual([])
  })

  it('accepts bounded direct wrappers', () => {
    const result = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ wrapped: true }),
    })

    expect(result.rowCount).toBe(1)
    expect(result.dynamicTextCount).toBe(2)
    expect(result.findings).toEqual([])
  })

  it('counts nested row labels without treating them as outer-row candidates', () => {
    const result = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ wrapped: true })
        .replace('firstBounds: { maxWidth: 120 }', "firstBounds: { flexDirection: 'row' }")
        .replace('secondBounds: { width: 100 }', "secondBounds: { flexDirection: 'row' }"),
    })

    expect(result.rowCount).toBe(1)
    expect(result.dynamicTextCount).toBe(2)
    expect(result.findings).toEqual([])
  })

  it('does not accept auto/zero dimensions or flexBasis alone as a visible sizing contract', () => {
    const result = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({
        firstStyle: ", width: 'auto', flexBasis: 0",
        secondStyle: ', maxWidth: 0, flexBasis: 20',
      }),
    })

    expect(result.findings).toHaveLength(2)
  })

  it('accepts explicit product ellipsis but not numberOfLines alone', () => {
    const explicit = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({
        firstProps: 'numberOfLines={1} ellipsizeMode="tail"',
        secondProps: 'numberOfLines={1} ellipsizeMode="tail"',
      }),
    })
    const implicit = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ firstProps: 'numberOfLines={1}', secondProps: 'numberOfLines={1}' }),
    })

    expect(explicit.findings).toEqual([])
    expect(implicit.findings).toHaveLength(2)
  })

  it('ignores fixed literal icon labels and custom Text components', () => {
    const fixed = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({ firstContent: "'A'", secondContent: "'B'" }),
    })
    const custom = scanFile({
      filePath: 'components/CustomProbe.tsx',
      content: fixture().replace(
        "import { StyleSheet, Text, View } from 'react-native'",
        "import { StyleSheet, View } from 'react-native'\nimport Text from './Text'",
      ),
    })

    expect(fixed.findings).toEqual([])
    expect(custom.findings).toEqual([])
  })

  it('treats one-argument translation lookups as dynamic text', () => {
    const result = scanFile({
      filePath: 'components/Probe.tsx',
      content: fixture({
        firstContent: "i18nT('transport.car')",
        secondContent: "i18nT('date.long')",
      }),
    })

    expect(result.dynamicTextCount).toBe(2)
    expect(result.findings).toEqual([
      expect.objectContaining({ key: 'components/Probe.tsx::row::first' }),
      expect.objectContaining({ key: 'components/Probe.tsx::row::second' }),
    ])
  })

  it('keeps long RU/BE/UK/PL/EN label variants inside the dynamic-risk fixture', () => {
    const localizedLabels = {
      ru: ['На машине с намеренно длинной подписью', '15 августа 2026 г., 09:00'],
      be: ['На аўтамабілі з вельмі доўгай назвай', '15 жніўня 2026 г., 09:00'],
      uk: ['Автомобілем із дуже довгою назвою', '15 серпня 2026 р., 09:00'],
      pl: ['Samochodem z bardzo długą nazwą', '15 sierpnia 2026, 09:00'],
      en: ['By car with an intentionally long label', 'August 15, 2026, 09:00'],
    }
    const declarations = `
      const localizedLabels = ${JSON.stringify(localizedLabels)}
      const locale = getCurrentLocale()
    `
    const content = fixture({
      declarations,
      firstContent: 'localizedLabels[locale][0]',
      secondContent: 'localizedLabels[locale][1]',
    })
    const result = scanFile({ filePath: 'components/Probe.tsx', content })

    for (const labels of Object.values(localizedLabels)) {
      expect(content).toContain(labels[0])
      expect(content).toContain(labels[1])
    }
    expect(result.dynamicTextCount).toBe(2)
    expect(result.findings).toHaveLength(2)
  })

  it('does not treat mutually exclusive conditional labels as concurrent siblings', () => {
    const content = `
      import { StyleSheet, Text, View } from 'react-native'
      import Feather from '@expo/vector-icons/Feather'
      const styles = StyleSheet.create({
        row: { flexDirection: 'row', flexWrap: 'wrap' },
        first: { fontSize: 13 },
        second: { fontSize: 13 },
      })
      export const Probe = () => (
        <View style={styles.row}>
          <Feather name="map-pin" />
          {pending ? (
            <Text style={styles.first}>{t('first', { value: first })}</Text>
          ) : (
            <Text style={styles.second}>{t('second', { value: second })}</Text>
          )}
        </View>
      )
    `

    expect(scanFile({ filePath: 'components/Probe.tsx', content }).findings).toEqual([])
  })

  it('rejects vacuous scans, oversized allowlists and stale entries', () => {
    const finding = {
      key: 'components/Probe.tsx::row::first',
      file: 'components/Probe.tsx',
      line: 1,
      rowStyle: 'row',
      textStyle: 'first',
    }
    const base = { files: 1, rowCount: 1, dynamicTextCount: 2, findings: [finding] }
    const oversized = Object.fromEntries(
      Array.from({ length: MAX_ALLOWLIST_ENTRIES + 1 }, (_, index) => [`entry-${index}`, 'reason']),
    )

    expect(evaluateFindings({ ...base, allowlist: { [finding.key]: 'reviewed' } }).ok).toBe(true)
    expect(evaluateFindings({ ...base, allowlist: { stale: 'old entry' } }).staleAllowlist).toEqual(['stale'])
    expect(evaluateFindings({ ...base, allowlist: oversized }).allowlistTooLarge).toBe(true)
    expect(
      evaluateFindings({ files: 0, rowCount: 0, dynamicTextCount: 0, findings: [], allowlist: {} }).vacuous,
    ).toBe(true)
  })

  it('rejects split-label iterations and accepts the combined-label result', () => {
    const filePath = 'components/trips/planning/TripPlanCard.tsx'
    const afterSource = fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
    const combinedLabel = [
      '        <Text style={styles.meta}>',
      '          {`${TRANSPORT_LABEL[trip.transport]} · ${formatTripDateTime(trip.startDate, trip.startTime)}`}',
      '        </Text>',
    ].join('\n')
    const competingLabels = [
      '        <Text style={styles.meta}>{TRANSPORT_LABEL[trip.transport]}</Text>',
      '        <Text style={styles.metaDot}>·</Text>',
      '        <Text style={styles.meta}>{formatTripDateTime(trip.startDate, trip.startTime)}</Text>',
    ].join('\n')
    const failedCompetingFlexSource = afterSource.replace(combinedLabel, competingLabels)
    const failedFlexShrinkSource = failedCompetingFlexSource.replace(
      'meta: { fontSize: 13, color: colors.textSecondary, flex: 1 },',
      'meta: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },',
    )
    const beforeSource = failedCompetingFlexSource
      .replace(
        'meta: { fontSize: 13, color: colors.textSecondary, flex: 1 },',
        'meta: { fontSize: 13, color: colors.textSecondary },',
      )
      .replaceAll('<Text style={styles.meta}>', '<Text style={styles.meta} numberOfLines={1}>')

    expect(beforeSource).not.toBe(afterSource)
    expect(failedFlexShrinkSource).not.toBe(afterSource)
    expect(failedCompetingFlexSource).not.toBe(afterSource)
    expect(afterSource).toContain(combinedLabel)
    expect(beforeSource.match(/style=\{styles\.meta\} numberOfLines=\{1\}/g)).toHaveLength(2)
    expect(scanFile({ filePath, content: beforeSource }).findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: `${filePath}::metaRow::meta` })]),
    )
    expect(scanFile({ filePath, content: failedFlexShrinkSource }).findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: `${filePath}::metaRow::meta` })]),
    )
    expect(scanFile({ filePath, content: failedCompetingFlexSource }).findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: `${filePath}::metaRow::meta` })]),
    )
    const afterResult = scanFile({ filePath, content: afterSource })
    expect(afterResult.findings).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: `${filePath}::metaRow::meta` })]),
    )
  })

  it('keeps the clean-checkout repository scan non-vacuous and allowlisted', () => {
    const result = scanTextRowSizing(process.cwd())

    expect(result.fileCount).toBeGreaterThan(100)
    expect(result.rowCount).toBeGreaterThan(0)
    expect(result.dynamicTextCount).toBeGreaterThan(0)
    expect(result.allowlistedCount).toBe(Object.keys(ALLOWLIST).length)
    expect(result.staleAllowlist).toEqual([])
    expect(result.violations).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('keeps --json machine-readable and returns a failing status for violations', () => {
    const rootDir = makeTempDir('guard-text-row-sizing-')
    try {
      writeTextFile(path.join(rootDir, 'components', 'Probe.tsx'), fixture())

      const result = runNodeCli([
        path.resolve(process.cwd(), 'scripts/guard-text-row-sizing.js'),
        '--root',
        rootDir,
        '--json',
      ])
      const payload = JSON.parse(result.stdout)

      expect(result.status).toBe(1)
      expect(result.stderr).toBe('')
      expect(payload).toMatchObject({ ok: false, vacuous: false, violationCount: 2 })
    } finally {
      removeDir(rootDir)
    }
  })
})
