const fs = require('fs')
const path = require('path')

const { makeTempDir, removeDir, runCli, writeTextFile } = require('./cli-test-utils')

const {
  ALLOWED_ROOT_FILES,
  buildJsonResult,
  classifyRootFile,
  evaluateGuard,
  isAllowedRootFile,
  isRootDotfile,
  listTrackedFiles,
  listUntrackedFiles,
  looksLikeScratchArtifact,
} = require('@/scripts/guard-root-scratch-artifacts')

const repoRoot = process.cwd()
const guardPath = path.resolve(repoRoot, 'scripts/guard-root-scratch-artifacts.js')
const readRepoFile = (file: string) => fs.readFileSync(path.resolve(repoRoot, file), 'utf8')
const violationFiles = (result: { violations: { file: string }[] }) => result.violations.map((v) => v.file)

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
    expect(result.violations).toEqual([
      expect.objectContaining({ file: '.codex-temp-probe.js', kind: 'scratch', origin: 'tracked' }),
    ])
  })

  it('rejects a root file whose name matches NO scratch convention at all', () => {
    // Ядро #1852. До закрытого списка `probe.mjs` не ловил никто: guard знал
    // только угаданные конвенции, git его принимал, eslint читал. Denylist
    // заведомо неполон — третий эпизод семьи пришёл именно под новым именем.
    const result = evaluateGuard({ trackedFiles: ['probe.mjs', 'check-1847.js', 'diag.json'] })

    expect(result.ok).toBe(false)
    expect(violationFiles(result)).toEqual(['probe.mjs', 'check-1847.js', 'diag.json'])
    for (const name of ['probe.mjs', 'check-1847.js', 'diag.json']) {
      expect(classifyRootFile(name)).toBe('unknown')
      expect(looksLikeScratchArtifact(name)).toBe(false)
    }
  })

  it('rejects a differently named dotfile of the same class', () => {
    const result = evaluateGuard({ trackedFiles: ['.probe-login.js', '.quest-audit-run.json'] })

    expect(result.ok).toBe(false)
    expect(violationFiles(result)).toEqual(['.probe-login.js', '.quest-audit-run.json'])
  })

  it('gives a different remediation to a scratch name and to an unknown new root file', () => {
    // Один и тот же совет на оба случая бесполезен: автору настоящего конфига
    // предлагали бы выбросить его файл, а автору пробы — объявить её в
    // allow-list. Поэтому конвенции denylist'а сохранены как классификатор.
    const result = evaluateGuard({ trackedFiles: ['__probe.js', 'notes.md'] })

    const scratch = result.violations.find((v: { file: string }) => v.file === '__probe.js')
    const unknown = result.violations.find((v: { file: string }) => v.file === 'notes.md')

    expect(scratch.kind).toBe('scratch')
    expect(scratch.remediation).toContain('.codex-temp/')
    expect(unknown.kind).toBe('unknown')
    expect(unknown.remediation).toContain('ALLOWED_ROOT_FILES')
    expect(unknown.remediation).toContain('scripts/guard-root-scratch-artifacts.js')
    expect(scratch.remediation).not.toEqual(unknown.remediation)
  })

  it('accepts real root config files and env examples', () => {
    const result = evaluateGuard({
      trackedFiles: [
        ...ALLOWED_ROOT_FILES,
        '.env.deploy.example',
        '.env.media-ops.example',
        'app/_layout.tsx',
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('keeps .env values themselves outside the allow-list', () => {
    expect(isAllowedRootFile('.env')).toBe(false)
    expect(isAllowedRootFile('.env.e2e')).toBe(false)
    expect(isAllowedRootFile('.env.deploy.example')).toBe(true)
  })

  it('reads the env-placeholder convention from guard-env-secrets, not from a private copy', () => {
    // Разошедшиеся трактовки одного имени означают, что штатный `.env.example`
    // краснеет здесь и одновременно считается легальным в guard-env-secrets.
    const { isAllowedEnvPlaceholder } = require('@/scripts/guard-env-secrets')

    for (const name of ['.env.example', '.env.deploy.example', '.env', '.env.e2e']) {
      expect(isAllowedRootFile(name)).toBe(isAllowedEnvPlaceholder(name) || ALLOWED_ROOT_FILES.has(name))
    }
    expect(isAllowedRootFile('.env.example')).toBe(true)
  })

  it('rejects one-off root scripts named without a leading dot', () => {
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
    expect(violationFiles(result)).toEqual([
      '__map_diag.mjs',
      '__probe.js',
      '__diag.ts',
      '_tmp-probe.mjs',
      'probe1847.tmp.mjs',
    ])
  })

  it('leaves declared root files and nested files alone', () => {
    for (const file of [
      'metro.config.js',
      'app.config.js',
      'queryKeys.ts',
      'scripts/_tmp-probe.mjs',
      'scripts/x.tmp.js',
      'scripts/probe.mjs',
      '__tests__/a.ts',
    ]) {
      expect(classifyRootFile(file)).toBe('allowed')
    }
  })

  it('keeps the allow-list in sync with what git actually tracks in the root', () => {
    // Обе стороны обязательны. Трекаемое имя вне списка — дыра ровно того
    // класса, ради которого список и заводился; запись без файла — мёртвое имя,
    // из-за которого список перестаёт быть осознанным решением.
    const trackedRootFiles = listTrackedFiles(repoRoot).filter((file: string) => !file.includes('/'))

    expect(evaluateGuard({ trackedFiles: trackedRootFiles })).toMatchObject({ ok: true })
    expect(trackedRootFiles.length).toBeGreaterThan(20)
    for (const declared of ALLOWED_ROOT_FILES) {
      expect(trackedRootFiles).toContain(declared)
    }
  })

  it('reads the untracked-but-not-ignored slice of the root, not only the index', () => {
    // Живой третий эпизод (`probe1847*.tmp.mjs`, 07.09.2026) был untracked:
    // индекс его не видел, а общий `npm run lint` уже краснел у всех. Игнор
    // при этом обязан оставаться выходом — игнорируемый файл не читает ни git,
    // ни eslint, и гейт он не красит.
    const repo = makeTempDir('guard-root-scratch-untracked-')
    try {
      runCli('git', ['init', '-q', '.'], { cwd: repo })
      writeTextFile(path.join(repo, '.gitignore'), '/__*.mjs\n')
      writeTextFile(path.join(repo, 'package.json'), '{}\n')
      runCli('git', ['add', '-A'], { cwd: repo })
      writeTextFile(path.join(repo, 'probe.mjs'), 'const a = 1\n')
      writeTextFile(path.join(repo, '__ignored.mjs'), 'const a = 1\n')
      writeTextFile(path.join(repo, 'nested', 'probe.mjs'), 'const a = 1\n')

      expect(listUntrackedFiles(repo).sort()).toEqual(['nested/probe.mjs', 'probe.mjs'])

      const result = evaluateGuard({
        trackedFiles: listTrackedFiles(repo),
        untrackedFiles: listUntrackedFiles(repo),
      })
      expect(result.ok).toBe(false)
      expect(result.violations).toEqual([
        expect.objectContaining({ file: 'probe.mjs', kind: 'unknown', origin: 'untracked' }),
      ])

      const run = runCli(process.execPath, [guardPath], { cwd: repo })
      expect(run.status).toBe(1)
      expect(run.stderr).toContain('probe.mjs')
      expect(run.stderr).toContain('untracked')
    } finally {
      removeDir(repo)
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

  it('records the closed-root contract in AGENTS.md, not only in the guard', () => {
    // Требование Done gate #1852: решение по untracked-сценарию записано, а не
    // оставлено умолчанием. Без записи следующая сессия трактует красный гейт
    // как чужую поломку и обходит его.
    const agents = readRepoFile('AGENTS.md')
    expect(agents).toContain('ALLOWED_ROOT_FILES')
    expect(agents).toMatch(/untracked/i)
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
    // Имя вне ВСЕХ конвенций: ни один игнор его не знает и знать не должен —
    // guard закрывает этот случай сам, allow-list'ом. Паритет тут в том, что
    // оба контура видят файл одинаково; асимметрии, которая уронила #1466, нет.
    const outsideEveryConvention = ['probe.mjs', 'check-1847.js']

    const eslintProbe = runCli(
      process.execPath,
      [
        '-e',
        `const { ESLint } = require('eslint')
         const files = ${JSON.stringify([...scratchProbes, ...keptFiles, ...outsideEveryConvention])}
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

    for (const outsider of outsideEveryConvention) {
      expect({ file: outsider, git: isGitIgnored(outsider), eslint: eslintIgnored[outsider] })
        .toEqual({ file: outsider, git: false, eslint: false })
      expect(classifyRootFile(outsider)).toBe('unknown')
    }
  })

  it('reads the repository root even when started from a subdirectory', () => {
    // `git ls-files` без pathspec видит только поддерево cwd: из `scripts/`
    // guard не увидел бы ни одного корневого файла и отчитался бы «passed».
    const seenFromSubdir = runCli(
      process.execPath,
      [
        '-e',
        'const g = require(process.argv[1]); process.stdout.write(String(g.listTrackedFiles().filter(g.isRootFile).length))',
        guardPath,
      ],
      { cwd: path.resolve(repoRoot, 'scripts') },
    )

    expect(seenFromSubdir.status).toBe(0)
    expect(Number(seenFromSubdir.stdout)).toBe(
      listTrackedFiles(repoRoot).filter((file: string) => !file.includes('/')).length,
    )
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

    expect(failing).toMatchObject({ contractVersion: 2, ok: false, violationCount: 1 })
    expect(failing.reason).toContain('.codex-temp/')
    expect(failing.violations[0]).toMatchObject({ kind: 'scratch', origin: 'tracked' })
    expect(buildJsonResult(evaluateGuard({ trackedFiles: ['package.json'] }))).toMatchObject({
      ok: true,
      violationCount: 0,
    })
  })
})
