const fs = require('fs')
const path = require('path')

const { makeTempDir, removeDir, runCli, writeTextFile } = require('./cli-test-utils')

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
    // `eslint.config.js` объявляет `__*` и `_tmp-*` разовой диагностикой и просто
    // их не читает: такой артефакт в git не покраснел бы нигде. Расширение тут
    // роли не играет — `__probe.js` воспроизводит #1846 ровно так же, как .mjs.
    const result = evaluateGuard({
      trackedFiles: [
        '__map_diag.mjs',
        '__probe.js',
        '__diag.ts',
        '_tmp-probe.mjs',
        'probe1847.tmp.mjs',
        'metro.config.js',
        '__tests__/scripts/x.test.ts',
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.violations.map((v: { file: string }) => v.file)).toEqual([
      '__map_diag.mjs',
      '__probe.js',
      '__diag.ts',
      '_tmp-probe.mjs',
      'probe1847.tmp.mjs',
    ])
  })

  it('leaves ordinary root config files and nested files alone', () => {
    for (const file of ['metro.config.js', 'app.config.js', 'queryKeys.ts', 'scripts/_tmp-probe.mjs', 'scripts/x.tmp.js', '__tests__/a.ts']) {
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
    // без gitignore-строк она уезжала бы в git молча. Расширения перечислены
    // поимённо: голый `/__*` унёс бы из git корневые `__tests__/` и `__mocks__/`.
    const gitignoreLines = gitignore.split('\n')
    for (const pattern of ['/__*.js', '/__*.cjs', '/__*.mjs', '/__*.ts', '/__*.tsx', '/_tmp-*', '/*.tmp.*']) {
      expect(gitignoreLines).toContain(pattern)
    }
    expect(gitignoreLines).not.toContain('/__*')

    const eslintConfig = readRepoFile('eslint.config.js')
    // `**/` не косметика: без него паттерн привязан к корню, а `.gitignore`
    // пишет те же имена без ведущего слэша и игнорирует их на любой глубине.
    expect(eslintConfig).toContain('"**/.codex-temp*"')
    expect(eslintConfig).toContain('"**/.codex-debug*"')
    expect(eslintConfig).toContain('"*.tmp.*"')
  })

  it('closes every scratch convention in BOTH git and eslint, not in one of them', () => {
    // Провал Done gate #1466 был именно асимметрией контуров: git такой файл в
    // коммит не пустит, а eslint прочитает его локально и покрасит общий гейт.
    // Поэтому проверяются оба контура одним набором имён.
    //
    // ESLint поднимается дочерним процессом: его flat-config грузится
    // динамическим import'ом, который внутри jest требует
    // `--experimental-vm-modules` и падает.
    const scratchProbes = [
      '.codex-temp-probe2.js',
      '.codex-debug-run.js',
      '__probe.js',
      '__diag.ts',
      '__map_diag.mjs',
      '_tmp-run.mjs',
      'probe9999.tmp.mjs',
      // Вложенные: `.gitignore` пишет их без ведущего слэша, значит git
      // игнорирует их на любой глубине — eslint обязан вести себя так же.
      'components/.codex-temp-probe.js',
      'scripts/.codex-debug-run.js',
    ]
    const keptFiles = ['metro.config.js', '__tests__/scripts/x.test.ts', '__mocks__/x.js', 'scripts/x.tmp.js']

    const eslintProbe = runCli(
      process.execPath,
      [
        '-e',
        `const { ESLint } = require('eslint')
         const files = ${JSON.stringify([...scratchProbes, ...keptFiles])}
         ;(async () => {
           const eslint = new ESLint()
           const out = {}
           for (const file of files) out[file] = await eslint.isPathIgnored(file)
           process.stdout.write(JSON.stringify(out))
         })()`,
      ],
      { cwd: repoRoot },
    )
    expect(eslintProbe.status).toBe(0)
    const eslintIgnored = JSON.parse(eslintProbe.stdout)

    const isGitIgnored = (file: string) =>
      runCli('git', ['check-ignore', '-q', file], { cwd: repoRoot }).status === 0

    for (const probe of scratchProbes) {
      expect({ file: probe, git: isGitIgnored(probe), eslint: eslintIgnored[probe] })
        .toEqual({ file: probe, git: true, eslint: true })
    }

    // Обратная сторона: настоящие каталоги и вложенные файлы не должны исчезать
    // ни из git, ни из линтера.
    for (const kept of keptFiles) {
      expect({ file: kept, git: isGitIgnored(kept), eslint: eslintIgnored[kept] })
        .toEqual({ file: kept, git: false, eslint: false })
    }
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

  it('sees a non-ASCII artifact name that git would otherwise quote', () => {
    // При дефолтном `core.quotePath` git отдаёт не-ASCII путь как
    // `".codex-\\321\\202..."`. Имя перестаёт начинаться с точки, и guard
    // отчитался бы «passed» на реальном артефакте — именно на чистом CI-runner'е,
    // где нет system-конфига, глушащего квотирование на машине разработчика.
    const repo = makeTempDir('guard-root-scratch-quotepath-')
    try {
      runCli('git', ['init', '-q', '.'], { cwd: repo })
      runCli('git', ['config', 'core.quotePath', 'true'], { cwd: repo })
      writeTextFile(path.join(repo, '.codex-темп-проба.js'), 'const a = 1\n')
      runCli('git', ['add', '-A', '-f'], { cwd: repo })

      expect(listTrackedFiles(repo)).toEqual(['.codex-темп-проба.js'])

      const run = runCli(process.execPath, [guardPath], { cwd: repo })
      expect(run.status).toBe(1)
      expect(run.stderr).toContain('.codex-темп-проба.js')
    } finally {
      removeDir(repo)
    }
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
