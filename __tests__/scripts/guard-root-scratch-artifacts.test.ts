const fs = require('fs')
const path = require('path')

const { runCli } = require('./cli-test-utils')

const {
  ALLOWED_ROOT_DOTFILES,
  buildJsonResult,
  evaluateGuard,
  isRootDotfile,
  isAllowedRootDotfile,
  isScratchArtifact,
  listTrackedFiles,
} = require('@/scripts/guard-root-scratch-artifacts')

const repoRoot = process.cwd()
const guardPath = path.resolve(repoRoot, 'scripts/guard-root-scratch-artifacts.js')
const readRepoFile = (file: string) => fs.readFileSync(path.resolve(repoRoot, file), 'utf8')

describe('guard-root-scratch-artifacts', () => {
  it.each([
    ['.codex-temp-probe.js', true],
    ['.codex-debug-run.mjs', true],
    ['.gitignore', true],
    ['components/MapPage/AddressSearch.tsx', false],
    ['.claude/settings.json', false],
    ['scripts/.tmp-probe.js', false],
  ])('classifies %s as root dotfile: %s', (file, expected) => {
    expect(isRootDotfile(file)).toBe(expected)
  })

  it('rejects the artifact that actually reached origin/main', () => {
    const result = evaluateGuard({
      trackedFiles: ['package.json', '.codex-temp-probe.js', 'components/MapPage/AddressSearch.tsx'],
    })

    expect(result.ok).toBe(false)
    expect(result.violations).toEqual([{ file: '.codex-temp-probe.js' }])
  })

  it('rejects a differently named artifact of the same class', () => {
    // Точечный паттерн `.codex-temp*` третий эпизод не поймает: guard закрывает
    // класс «новый top-level dotfile», а не конкретное имя.
    const result = evaluateGuard({ trackedFiles: ['.probe-login.js', '.quest-audit-run.json'] })

    expect(result.ok).toBe(false)
    expect(result.violations.map((v: { file: string }) => v.file)).toEqual([
      '.probe-login.js',
      '.quest-audit-run.json',
    ])
  })

  it('accepts real root config dotfiles and env examples', () => {
    const result = evaluateGuard({
      trackedFiles: [
        ...ALLOWED_ROOT_DOTFILES,
        '.env.deploy.example',
        '.env.media-ops.example',
        'app/_layout.tsx',
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('keeps .env values themselves outside the allow-list', () => {
    expect(isAllowedRootDotfile('.env')).toBe(false)
    expect(isAllowedRootDotfile('.env.e2e')).toBe(false)
    expect(isAllowedRootDotfile('.env.deploy.example')).toBe(true)
  })

  it('reads the env-placeholder convention from guard-env-secrets, not from a private copy', () => {
    // Разошедшиеся трактовки одного имени означают, что штатный `.env.example`
    // краснеет здесь и одновременно считается легальным в guard-env-secrets.
    const { isAllowedEnvPlaceholder } = require('@/scripts/guard-env-secrets')

    for (const name of ['.env.example', '.env.deploy.example', '.env', '.env.e2e']) {
      expect(isAllowedRootDotfile(name)).toBe(isAllowedEnvPlaceholder(name) || ALLOWED_ROOT_DOTFILES.has(name))
    }
    expect(isAllowedRootDotfile('.env.example')).toBe(true)
  })

  it('rejects one-off root scripts named without a leading dot', () => {
    // `eslint.config.js` объявляет `__*.mjs` и `_tmp-*` разовой диагностикой и
    // просто их не читает: такой артефакт в git не покраснел бы нигде.
    const result = evaluateGuard({
      trackedFiles: ['__map_diag.mjs', '_tmp-probe.mjs', 'metro.config.js', '__tests__/scripts/x.test.ts'],
    })

    expect(result.ok).toBe(false)
    expect(result.violations.map((v: { file: string }) => v.file)).toEqual(['__map_diag.mjs', '_tmp-probe.mjs'])
  })

  it('leaves ordinary root config files and nested files alone', () => {
    for (const file of ['metro.config.js', 'app.config.js', 'queryKeys.ts', 'scripts/_tmp-probe.mjs', '__tests__/a.ts']) {
      expect(isScratchArtifact(file)).toBe(false)
    }
  })

  it('keeps the allow-list in sync with what git actually tracks in the root', () => {
    // Расхождение здесь означает, что allow-list превратился в список мёртвых
    // имён и перестал быть осознанным решением.
    const tracked = listTrackedFiles(repoRoot).filter((file: string) => isRootDotfile(file))

    expect(evaluateGuard({ trackedFiles: tracked })).toMatchObject({ ok: true })
    for (const allowed of ALLOWED_ROOT_DOTFILES) {
      expect(tracked).toContain(allowed)
    }
  })

  it('wires the guard into both shared gates, not only into lint', () => {
    // `lint` ловит артефакт уже постфактум: к тому моменту он на origin/main.
    // Предотвращает коммит именно `check:fast` (githook/pre-commit), поэтому
    // guard обязан стоять в обоих, и стоять безусловно.
    const packageJson = JSON.parse(readRepoFile('package.json'))
    expect(packageJson.scripts.lint).toContain('npm run guard:root-scratch-artifacts')
    expect(packageJson.scripts['lint:ci']).toContain('npm run guard:root-scratch-artifacts')

    const fastScopeChecks = readRepoFile('scripts/run-fast-scope-checks.js')
    expect(fastScopeChecks).toContain("runCommand('npm', ['run', 'guard:root-scratch-artifacts'])")
  })

  it('keeps the scratch-artifact convention ignored by prefix, not by directory', () => {
    // Директорийный `.codex-temp/` не матчит одиночный `.codex-temp-probe.js` —
    // ровно эта дыра и увела файл в origin/main.
    const gitignore = readRepoFile('.gitignore')
    expect(gitignore).toMatch(/^\.codex-temp\*$/m)
    expect(gitignore).toMatch(/^\.codex-debug\*$/m)
    // Разовая диагностика без точки в имени игнорируется eslint'ом, поэтому
    // без gitignore-строк она уезжала бы в git молча.
    expect(gitignore).toMatch(/^\/__\*\.mjs$/m)
    expect(gitignore).toMatch(/^\/_tmp-\*$/m)

    const eslintConfig = readRepoFile('eslint.config.js')
    expect(eslintConfig).toContain('".codex-temp*"')
    expect(eslintConfig).toContain('".codex-debug*"')
  })

  it('reads the repository root even when started from a subdirectory', () => {
    // `git ls-files` без pathspec видит только поддерево cwd: из `scripts/`
    // guard не увидел бы ни одного корневого файла и отчитался бы «passed».
    const seenFromSubdir = runCli(
      process.execPath,
      [
        '-e',
        'const g = require(process.argv[1]); process.stdout.write(String(g.listTrackedFiles().filter(g.isRootDotfile).length))',
        guardPath,
      ],
      { cwd: path.resolve(repoRoot, 'scripts') },
    )

    expect(seenFromSubdir.status).toBe(0)
    expect(Number(seenFromSubdir.stdout)).toBe(listTrackedFiles(repoRoot).filter(isRootDotfile).length)
    expect(Number(seenFromSubdir.stdout)).toBeGreaterThan(0)
  })

  it('keeps the --json payload shaped for automation', () => {
    const failing = buildJsonResult(evaluateGuard({ trackedFiles: ['.codex-temp-probe.js'] }))

    expect(failing).toMatchObject({ contractVersion: 1, ok: false, violationCount: 1 })
    expect(failing.reason).toContain('.codex-temp/')
    expect(buildJsonResult(evaluateGuard({ trackedFiles: ['package.json'] }))).toMatchObject({
      ok: true,
      violationCount: 0,
    })
  })
})
