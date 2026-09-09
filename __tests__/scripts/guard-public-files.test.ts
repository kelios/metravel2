const fs = require('fs')
const path = require('path')
const { makeTempDir, runCli, writeTextFile, removeDir } = require('./cli-test-utils')
const { evaluateGuard } = require('@/scripts/guard-public-files')

const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'scripts/guard-public-files.js')

describe('guard-public-files', () => {
  let fixtureRoot: string
  let publicDir: string
  let fixtureScript: string

  beforeEach(() => {
    fixtureRoot = makeTempDir('public-files-')
    publicDir = path.join(fixtureRoot, 'public')
    fixtureScript = path.join(fixtureRoot, 'scripts/guard-public-files.js')
    // Copy the real tree, not files generated from the allowlist under test.
    fs.cpSync(path.join(repoRoot, 'public'), publicDir, { recursive: true })
    writeTextFile(fixtureScript, fs.readFileSync(scriptPath, 'utf8'))
  })

  afterEach(() => removeDir(fixtureRoot))

  it('passes the actual repository tree, including Expo assets and dot-directories', () => {
    const result = evaluateGuard()
    expect(result.violations).toEqual([])
    expect(result.files).toEqual(expect.arrayContaining([
      '.well-known/assetlinks.json',
      'static/quests/quest-default-cover.svg',
      'assets/icons/logo_yellow_512x512.png',
      'travel-hero-preload-v2.js',
    ]))
    expect(runCli(process.execPath, [scriptPath], { cwd: fixtureRoot }).status).toBe(0)
  })

  it.each([
    'travel-hero-preload.js',
    'assets/icons/forgotten.png',
    '.well-known/forgotten.json',
    '.DS_Store',
    'new/deep/directory/forgotten.js',
  ])('rejects an unreferenced, untracked file %s and passes after removal', (file: string) => {
    const extraPath = path.join(publicDir, file)
    writeTextFile(extraPath, 'orphan')
    const failed = runCli(process.execPath, [fixtureScript])
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain(`Undeclared file: public/${file}`)
    expect(failed.stderr).toContain('asset author')
    expect(failed.stderr).toContain('PUBLIC_FILES (scripts/guard-public-files.js)')
    fs.unlinkSync(extraPath)
    expect(runCli(process.execPath, [fixtureScript]).status).toBe(0)
  })

  it('requires removal of a stale registry entry when an asset is deleted', () => {
    fs.unlinkSync(path.join(publicDir, 'icon.svg'))
    expect(evaluateGuard(publicDir).violations).toContain('Registered file missing: public/icon.svg')
  })

  it('does not scan other repository directories or nested worktrees', () => {
    writeTextFile(path.join(fixtureRoot, '.claude/worktrees/other/public/orphan.js'), 'orphan')
    writeTextFile(path.join(fixtureRoot, 'scripts/orphan.js'), 'orphan')
    expect(evaluateGuard(publicDir).ok).toBe(true)
  })

  it('rejects symlinks without traversing targets or cycles', () => {
    fs.symlinkSync(fixtureRoot, path.join(publicDir, 'cycle'), 'dir')
    fs.unlinkSync(path.join(publicDir, 'icon.svg'))
    fs.symlinkSync(path.join(publicDir, 'missing.svg'), path.join(publicDir, 'icon.svg'))
    const result = evaluateGuard(publicDir)
    expect(result.ok).toBe(false)
    expect(result.violations).toContain('Unsupported entry (symlink or special file): public/cycle')
    expect(result.violations).toContain('Unsupported entry (symlink or special file): public/icon.svg')
  })

  it('fails closed when public/ is missing or is a symlink', () => {
    fs.renameSync(publicDir, `${publicDir}-real`)
    expect(runCli(process.execPath, [fixtureScript]).status).toBe(1)
    fs.symlinkSync(`${publicDir}-real`, publicDir, 'dir')
    expect(runCli(process.execPath, [fixtureScript]).status).toBe(1)
  })

  it('is wired into both lint entry points and unconditional check:fast guards', () => {
    const { scripts } = require('../../package.json')
    expect(scripts['guard:public-files']).toBe('node scripts/guard-public-files.js')
    for (const command of ['lint', 'lint:ci']) {
      expect(scripts[command]).toContain('npm run guard:public-files &&')
    }
    const fastChecks = fs.readFileSync(path.join(repoRoot, 'scripts/run-fast-scope-checks.js'), 'utf8')
    expect(fastChecks).toContain("runCommand('npm', ['run', 'guard:public-files'])")
    expect(fastChecks).toContain('process.exit(publicFilesGuardStatus)')
  })
})
