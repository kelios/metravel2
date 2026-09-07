import fs from 'node:fs'
import path from 'node:path'

import {
  makeTempDir,
  removeDir,
  runNodeCli,
  writeTextFile,
} from './cli-test-utils'

const repoRoot = path.resolve(__dirname, '../..')
const guardPath = path.join(repoRoot, 'scripts/guard-themed-colors.js')
const baselinePath = path.join(repoRoot, 'scripts/themed-colors-baseline.json')

const {
  NO_THEMED_COUNTERPART,
  SCAN_DIRS,
  THEMED,
  THEME_INVARIANT,
  CONTRACT_VERSION,
  collectTokenReads,
  isScannedFile,
  loadCatalog,
  scanThemedColors,
} = require('@/scripts/guard-themed-colors')

const { classification, counterparts } = loadCatalog()

describe('guard-themed-colors', () => {
  it('derives the token classification from the design system source', () => {
    // `surface` расходится между светлой и тёмной палитрой и есть в
    // `getThemedColors()` — единственный класс, который вообще чинится.
    expect(classification.surface).toBe(THEMED)
    // `textOnDark` — белый в обеих темах: чинить нечего.
    expect(classification.textOnDark).toBe(THEME_INVARIANT)
    // У `bookPage*` и `travelPoint` тематического аналога нет вовсе.
    expect(classification.bookPageSurface).toBe(NO_THEMED_COUNTERPART)
    expect(classification.travelPoint).toBe(NO_THEMED_COUNTERPART)
  })

  it('finds the themed counterpart by palette entry, not by token name', () => {
    // `getThemedColors()` не содержит ни `error`, ни `card`, но оба собраны из
    // тех же палитровых записей, что тематические `danger` и `surface`: поиск по
    // имени объявил бы их «чинить нечем» и вывел из-под гейта.
    expect(classification.error).toBe(THEMED)
    expect(counterparts.error).toBe('danger')
    expect(classification.card).toBe(THEMED)
    expect(counterparts.card).toBe('surface')
  })

  it('does not let an import alias hide the read', () => {
    const aliased = collectTokenReads(
      [
        "import { DESIGN_TOKENS as DT } from '@/constants/designSystem'",
        'export const s = { backgroundColor: DT.colors.surface }',
      ].join('\n'),
      'components/Aliased.tsx',
      classification,
    )
    expect(aliased).toEqual([{ line: 2, token: 'surface', classification: THEMED }])

    const namespaced = collectTokenReads(
      [
        "import * as DS from '@/constants/designSystem'",
        'export const s = { backgroundColor: DS.DESIGN_TOKENS.colors.surface }',
      ].join('\n'),
      'components/Namespaced.tsx',
      classification,
    )
    expect(namespaced).toEqual([{ line: 2, token: 'surface', classification: THEMED }])
  })

  it('does not let a local re-alias of the DESIGN_TOKENS root hide the read', () => {
    // `const alias = DESIGN_TOKENS` уходит из-под трекинга биндингов на
    // импорте: без слежения за переприсвоением `alias.colors.surface` был бы
    // невидим для гейта одной строкой переименования внутри файла.
    const reads = collectTokenReads(
      [
        "import { DESIGN_TOKENS } from '@/constants/designSystem'",
        'const alias = DESIGN_TOKENS',
        'export const s = { backgroundColor: alias.colors.surface }',
      ].join('\n'),
      'components/RootAlias.tsx',
      classification,
    )
    expect(reads).toEqual([{ line: 3, token: 'surface', classification: THEMED }])
  })

  it('does not let destructuring the colors sub-object hide the read', () => {
    // `const { colors } = DESIGN_TOKENS` не оставляет ни одного текстового
    // `.colors`-обращения: без разбора паттерна деструктуризации гейт видел
    // здесь ноль чтений.
    const destructured = collectTokenReads(
      [
        "import { DESIGN_TOKENS } from '@/constants/designSystem'",
        'const { colors } = DESIGN_TOKENS',
        'export const s = { backgroundColor: colors.surface }',
      ].join('\n'),
      'components/ColorsDestructured.tsx',
      classification,
    )
    expect(destructured).toEqual([
      { line: 2, token: '<dynamic>', classification: THEMED },
      { line: 3, token: 'surface', classification: THEMED },
    ])

    // Тот же обход под переименованным именем и через namespace-импорт.
    const renamed = collectTokenReads(
      [
        "import { DESIGN_TOKENS } from '@/constants/designSystem'",
        'const { colors: c } = DESIGN_TOKENS',
        'export const s = { color: c.error }',
      ].join('\n'),
      'components/ColorsRenamed.tsx',
      classification,
    )
    expect(renamed).toEqual([
      { line: 2, token: '<dynamic>', classification: THEMED },
      { line: 3, token: 'error', classification: THEMED },
    ])
  })

  it('does not let a plain alias of DESIGN_TOKENS.colors undercount repeated reads', () => {
    // `const colors = DESIGN_TOKENS.colors` уже засчитывался один раз в строке
    // объявления; каждое дальнейшее `colors.token` должно получить свою
    // точную запись, а не молча слиться в тот же один `<dynamic>`.
    const reads = collectTokenReads(
      [
        "import { DESIGN_TOKENS } from '@/constants/designSystem'",
        'const colors = DESIGN_TOKENS.colors',
        'export const s1 = { backgroundColor: colors.surface }',
        'export const s2 = { color: colors.text }',
      ].join('\n'),
      'components/ColorsAlias.tsx',
      classification,
    )
    expect(reads).toEqual([
      { line: 2, token: '<dynamic>', classification: THEMED },
      { line: 3, token: 'surface', classification: THEMED },
      { line: 4, token: 'text', classification: THEMED },
    ])
  })

  it('does not blame a correctly themed read that shadows an alias name', () => {
    // Файл в процессе миграции держит и алиас `DESIGN_TOKENS.colors`, и своё
    // `const colors = useThemedColors()`. Нарушение здесь — только объявление
    // алиаса; обвинить строку, которая как раз следует правилу, гейт не вправе.
    const reads = collectTokenReads(
      [
        "import { DESIGN_TOKENS } from '@/constants/designSystem'",
        "import { useThemedColors } from '@/hooks/useTheme'",
        'const colors = DESIGN_TOKENS.colors',
        'export function Card() {',
        '  const colors = useThemedColors()',
        '  return { backgroundColor: colors.surface }',
        '}',
      ].join('\n'),
      'components/Shadowed.tsx',
      classification,
    )

    expect(reads).toEqual([{ line: 3, token: '<dynamic>', classification: THEMED }])
  })

  it('reads tokens through the AST, so comments and strings do not count', () => {
    const reads = collectTokenReads(
      [
        "import { DESIGN_TOKENS } from '@/constants/designSystem'",
        '// DESIGN_TOKENS.colors.surface в комментарии — не чтение',
        "const doc = 'DESIGN_TOKENS.colors.surface'",
        'export const styles = { card: { backgroundColor: DESIGN_TOKENS.colors.surface } }',
      ].join('\n'),
      'components/Card.tsx',
      classification,
    )

    expect(reads).toEqual([{ line: 4, token: 'surface', classification: THEMED }])
  })

  it('treats a token hidden behind dynamic access as themed', () => {
    const reads = collectTokenReads(
      'const value = DESIGN_TOKENS.colors[key]\nconst { surface } = DESIGN_TOKENS.colors\n',
      'components/Card.tsx',
      classification,
    )

    expect(reads).toEqual([
      { line: 1, token: '<dynamic>', classification: THEMED },
      { line: 2, token: '<dynamic>', classification: THEMED },
    ])
  })

  it('exempts web-only files, where the token stays a live CSS variable', () => {
    expect(isScannedFile('components/ui/ToastHost.tsx')).toBe(true)
    expect(isScannedFile('components/ui/ToastHost.web.tsx')).toBe(false)
    expect(isScannedFile('components/ui/ToastHost.native.tsx')).toBe(true)
    expect(isScannedFile('components/ui/__tests__/ToastHost.tsx')).toBe(false)
  })

  it('counts only themed reads when scanning a tree', () => {
    const root = makeTempDir('metravel-themed-colors-scan-')
    try {
      writeTextFile(
        path.join(root, 'components/Card.tsx'),
        'export const s = { backgroundColor: DESIGN_TOKENS.colors.surface }\n',
      )
      writeTextFile(
        path.join(root, 'components/Overlay.tsx'),
        'export const s = { color: DESIGN_TOKENS.colors.textOnDark }\n',
      )
      writeTextFile(
        path.join(root, 'components/Toast.web.tsx'),
        'export const s = { backgroundColor: DESIGN_TOKENS.colors.surface }\n',
      )
      // `utils/` в области: оттуда цвет доезжает до RN-индикатора пароля.
      writeTextFile(
        path.join(root, 'utils/passwordColors.ts'),
        'export const s = { color: DESIGN_TOKENS.colors.error }\n',
      )
      writeTextFile(
        path.join(root, 'services/outOfScope.ts'),
        'export const s = { backgroundColor: DESIGN_TOKENS.colors.surface }\n',
      )

      const scan = scanThemedColors(root, classification)

      expect(Object.keys(scan.files)).toEqual(['components/Card.tsx', 'utils/passwordColors.ts'])
      expect(scan.totals.occurrences).toBe(2)
      expect(scan.totals.exempt[THEME_INVARIANT]).toBe(1)
    } finally {
      removeDir(root)
    }
  })

  it('fails with file and line on a violation added over the baseline', () => {
    const root = makeTempDir('metravel-themed-colors-cli-')
    const syntheticBaseline = path.join(root, 'baseline.json')
    try {
      writeTextFile(
        path.join(root, 'components/Legacy.tsx'),
        'export const s = { backgroundColor: DESIGN_TOKENS.colors.surface }\n',
      )

      const update = runNodeCli([guardPath, '--root', root, '--baseline', syntheticBaseline, '--update'])
      expect(update.status).toBe(0)

      const pass = runNodeCli([guardPath, '--root', root, '--baseline', syntheticBaseline])
      expect(pass.status).toBe(0)

      writeTextFile(
        path.join(root, 'components/New.tsx'),
        '\nexport const s = { color: DESIGN_TOKENS.colors.text }\n',
      )
      const fail = runNodeCli([guardPath, '--root', root, '--baseline', syntheticBaseline])

      expect(fail.status).toBe(1)
      expect(fail.stderr).toContain('components/New.tsx:2 DESIGN_TOKENS.colors.text')
      expect(fail.stderr).toContain('useThemedColors()')

      // Легаси-файл из baseline тоже держит планку: разрешён ровно записанный счёт.
      fs.rmSync(path.join(root, 'components/New.tsx'))
      writeTextFile(
        path.join(root, 'components/Legacy.tsx'),
        'export const s = { backgroundColor: DESIGN_TOKENS.colors.surface }\n' +
        'export const t = { color: DESIGN_TOKENS.colors.text }\n',
      )
      const grown = runNodeCli([guardPath, '--root', root, '--baseline', syntheticBaseline])

      expect(grown.status).toBe(1)
      expect(grown.stderr).toContain('components/Legacy.tsx baseline=1 current=2')
    } finally {
      removeDir(root)
    }
  })

  it('never rewrites the baseline outside --update', () => {
    const root = makeTempDir('metravel-themed-colors-baseline-')
    const syntheticBaseline = path.join(root, 'baseline.json')
    try {
      writeTextFile(
        path.join(root, 'components/Legacy.tsx'),
        'export const s = { backgroundColor: DESIGN_TOKENS.colors.surface }\n',
      )
      runNodeCli([guardPath, '--root', root, '--baseline', syntheticBaseline, '--update'])
      const recorded = fs.readFileSync(syntheticBaseline, 'utf8')

      writeTextFile(
        path.join(root, 'components/New.tsx'),
        'export const s = { color: DESIGN_TOKENS.colors.text }\n',
      )
      runNodeCli([guardPath, '--root', root, '--baseline', syntheticBaseline])

      expect(fs.readFileSync(syntheticBaseline, 'utf8')).toBe(recorded)
    } finally {
      removeDir(root)
    }
  })

  it('keeps the committed baseline aligned with the guard contract', () => {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))

    expect(baseline.contractVersion).toBe(CONTRACT_VERSION)
    expect(baseline.scope).toEqual([...SCAN_DIRS])
    // Пустой baseline означал бы сломанный разбор каталога, а не чистое дерево.
    expect(baseline.totals.occurrences).toBeGreaterThan(0)
  })

  it('runs inside npm run lint', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))

    expect(packageJson.scripts['guard:themed-colors']).toBe('node scripts/guard-themed-colors.js')
    expect(packageJson.scripts.lint).toContain('npm run guard:themed-colors')
    expect(packageJson.scripts['lint:ci']).toContain('npm run guard:themed-colors')
  })
})
