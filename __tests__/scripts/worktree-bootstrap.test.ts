/** @jest-environment node */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { bootstrap, main, resolvePrimary, ENV_FILES, ANDROID_FILES, FONT_DIR } = require('../../scripts/worktree-bootstrap')

const HEAD = 'a'.repeat(40)
const SENTINEL = 'PRIVATE_FIXTURE_DO_NOT_LOG_2744'
const CANONICAL = 'git@github.com:kelios/metravel2.git'
const sha = (bytes: string | Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')

describe('worktree environment bootstrap', () => {
  let scratch: string
  let source: string
  let target: string
  let legacy: boolean
  let sourceOrigin: string
  let shared: boolean
  let reachable: boolean
  let quotedLegacy: boolean
  let tracked: Set<string>
  let nonIgnored: Set<string>
  let log: jest.Mock
  let policyCalls: Array<{ root: string; args: string[]; input?: string }>

  function write(root: string, relative: string, value = SENTINEL) {
    const file = path.join(root, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, value)
    return file
  }

  function git(root: string, args: string[], input?: string) {
    const command = args.join(' ')
    const common = root === target && !shared ? path.join(source, '.git') : path.join(root, '.git')
    const primary = root === target && !shared ? source : root
    let stdout = ''
    let status = 0
    if (command === 'rev-parse --show-toplevel') stdout = root
    else if (command === 'rev-parse --git-common-dir') stdout = common
    else if (command === 'rev-parse --git-path objects') stdout = path.join(root, '.git/objects')
    else if (command === 'remote get-url origin') stdout = root === target && shared ? source : sourceOrigin
    else if (command === 'rev-parse HEAD') stdout = HEAD
    else if (command.startsWith('for-each-ref --contains=')) stdout = reachable ? 'refs/heads/main' : ''
    else if (command === 'worktree list --porcelain -z') {
      if (legacy) status = 129
      else stdout = `worktree ${primary}\0HEAD ${HEAD}\0branch refs/heads/main\0\0`
    } else if (command === 'worktree list --porcelain') {
      stdout = `worktree ${quotedLegacy ? '"untrusted\\npath"' : primary}\nHEAD ${HEAD}\n\n`
    } else if (args[0] === 'ls-files') {
      policyCalls.push({ root, args: [...args], input })
      stdout = args.slice(3).filter((relative) => tracked.has(`${root}:${relative}`)).map((relative) => `${relative}\0`).join('')
    } else if (args[0] === 'check-ignore') {
      policyCalls.push({ root, args: [...args], input })
      const paths = (input ?? '').split('\0').slice(0, -1)
      const ignored = paths.filter((relative) => !nonIgnored.has(`${root}:${relative}`))
      stdout = paths.map((relative) => [
        ...(nonIgnored.has(`${root}:${relative}`) ? ['', '', ''] : ['.gitignore', '1', '**']), relative, '',
      ].join('\0')).join('')
      status = ignored.length ? 0 : 1
    } else throw new Error(`Unexpected fixture Git command: ${command}`)
    return { stdout, status }
  }

  function fonts(count = 1) {
    const faces = Array.from({ length: count }, (_, index) => {
      const bytes = Buffer.from(`wOF2fixture-font-${index}`)
      return { bytes, name: `${sha(bytes)}.woff2` }
    })
    const css = faces.map(({ name }) => `@font-face{src:url(https://book-snapshot.invalid/fonts/${name})}`).join('\n')
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Roboto'
    const lock = JSON.stringify({
      source_url: fontUrl, stylesheet_sha256: sha(css), stylesheet_size_bytes: Buffer.byteLength(css),
      files: faces.map(({ bytes, name }) => ({ path: name, sha256: sha(bytes), size_bytes: bytes.length })),
    })
    for (const root of [source, target]) {
      write(root, 'workers/book-renderer/fonts.lock.json', lock)
      write(root, 'services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument.ts', `const url = "${fontUrl}"`)
    }
    write(source, `${FONT_DIR}/fonts.css`, css)
    write(source, `${FONT_DIR}/fonts.lock.json`, lock)
    for (const { bytes, name } of faces) fs.writeFileSync(write(source, `${FONT_DIR}/${name}`), bytes)
    return faces[0].name
  }

  beforeEach(() => {
    const temporaryRoot = path.resolve(__dirname, '../../.codex-temp/tests')
    fs.mkdirSync(temporaryRoot, { recursive: true })
    scratch = fs.mkdtempSync(path.join(temporaryRoot, 'bootstrap-'))
    source = path.join(scratch, 'primary')
    target = path.join(scratch, 'checkout')
    for (const root of [source, target]) {
      write(root, 'package.json', JSON.stringify({ name: 'metravel' }))
      fs.mkdirSync(path.join(root, '.git/objects/info'), { recursive: true })
    }
    for (const relative of [...ENV_FILES, ...ANDROID_FILES]) write(source, relative)
    legacy = false
    sourceOrigin = CANONICAL
    shared = false
    reachable = true
    quotedLegacy = false
    tracked = new Set()
    nonIgnored = new Set()
    log = jest.fn()
    policyCalls = []
  })

  afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }))

  it('copies only the declared env and pinned-font records into independent files', () => {
    const fontName = fonts()
    write(source, '.secrets/unrelated.json')
    write(source, `${FONT_DIR}/unrelated.txt`)
    write(source, '.env.local')
    const result = bootstrap({ root: target, git, log })
    expect(result.map((item: { relative: string }) => item.relative).sort()).toEqual([
      ...ENV_FILES, `${FONT_DIR}/fonts.css`, `${FONT_DIR}/fonts.lock.json`, `${FONT_DIR}/${fontName}`,
    ].sort())
    for (const relative of ENV_FILES) {
      expect(fs.readFileSync(path.join(target, relative), 'utf8')).toBe(SENTINEL)
      expect(fs.lstatSync(path.join(target, relative)).isSymbolicLink()).toBe(false)
      expect(fs.statSync(path.join(target, relative)).mode & 0o777).toBe(0o600)
    }
    write(target, '.env', 'changed target')
    expect(fs.readFileSync(path.join(source, '.env'), 'utf8')).toBe(SENTINEL)
    expect(fs.existsSync(path.join(target, '.env.local'))).toBe(false)
    expect(fs.existsSync(path.join(target, '.secrets'))).toBe(false)
    expect(fs.existsSync(path.join(target, `${FONT_DIR}/unrelated.txt`))).toBe(false)
    expect(log.mock.calls.flat().join('\n')).not.toContain(SENTINEL)
    expect(log.mock.calls.flat().join('\n')).toContain('npm run android:prebuild')
    expect(log.mock.calls.flat().join('\n')).toContain('LC_ALL=en_US.UTF-8 pod install')
  })

  it('preserves existing files and replaces them only with explicit force', () => {
    write(target, '.env', 'target configuration')
    bootstrap({ root: target, git, log })
    expect(fs.readFileSync(path.join(target, '.env'), 'utf8')).toBe('target configuration')
    expect(log).toHaveBeenCalledWith('kept: .env')
    bootstrap({ root: target, git, log, force: true })
    expect(fs.readFileSync(path.join(target, '.env'), 'utf8')).toBe(SENTINEL)
  })

  it('checks a real-sized pinned font bundle with four policy Git calls, including force', () => {
    fonts(138)
    const files = [...ENV_FILES, ...fs.readdirSync(path.join(source, FONT_DIR)).map((name: string) => `${FONT_DIR}/${name}`)]
    for (const force of [false, true]) {
      policyCalls = []
      const result = bootstrap({ root: target, git, log, force })
      expect(result).toHaveLength(files.length)
      expect(result.every((item: { action: string }) => item.action === 'copied')).toBe(true)
      expect(policyCalls).toHaveLength(4)
      for (const root of [source, target]) {
        const calls = policyCalls.filter((call) => call.root === root)
        expect(calls).toHaveLength(2)
        expect(calls[0].args.slice(0, 3)).toEqual(['ls-files', '-z', '--'])
        expect([...calls[0].args.slice(3)].sort()).toEqual([...files].sort())
        expect(calls[1].args).toEqual(['check-ignore', '--no-index', '--verbose', '--non-matching', '-z', '--stdin'])
        expect(calls[1].input?.split('\0').slice(0, -1).sort()).toEqual([...files].sort())
      }
      for (const relative of files) {
        const from = path.join(source, relative)
        const to = path.join(target, relative)
        expect(fs.readFileSync(to).equals(fs.readFileSync(from))).toBe(true)
        expect(fs.statSync(to).ino).not.toBe(fs.statSync(from).ino)
      }
    }
    expect(log.mock.calls.flat().join('\n')).not.toContain(SENTINEL)
  })

  it('requires explicit Android secret opt-in and still excludes unrelated secrets', () => {
    write(source, '.secrets/ssh-private-key')
    bootstrap({ root: target, git, log, androidSecrets: true })
    expect(fs.readdirSync(path.join(target, '.secrets')).sort()).toEqual(ANDROID_FILES.map((name: string) => path.basename(name)).sort())
    for (const relative of ANDROID_FILES) expect(fs.statSync(path.join(target, relative)).mode & 0o777).toBe(0o600)
    expect(log.mock.calls.flat().join('\n')).not.toContain(SENTINEL)
  })

  it('reports missing sources without generating credentials', () => {
    fs.unlinkSync(path.join(source, '.env.e2e'))
    bootstrap({ root: target, git, log })
    expect(fs.existsSync(path.join(target, '.env.e2e'))).toBe(false)
    expect(log).toHaveBeenCalledWith('missing: .env.e2e')
  })

  it('does nothing when invoked in the primary checkout', () => {
    expect(bootstrap({ root: source, git, log })).toEqual([])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('nothing copied'))
  })

  it('supports installed legacy Git without unsafe quoted-path parsing', () => {
    legacy = true
    expect(resolvePrimary(target, git)).toBe(source)
    quotedLegacy = true
    expect(() => resolvePrimary(target, git)).toThrow('newer Git')
  })

  it('resolves a shared clone only with matching borrowed objects and reachable HEAD', () => {
    shared = true
    write(target, '.git/objects/info/alternates', path.join(source, '.git/objects'))
    expect(resolvePrimary(target, git)).toBe(source)
    reachable = false
    expect(() => resolvePrimary(target, git)).toThrow('not reachable')
    reachable = true
    write(target, '.git/objects/info/alternates', path.join(target, '.git/objects'))
    expect(() => resolvePrimary(target, git)).toThrow('does not match')
    fs.unlinkSync(path.join(target, '.git/objects/info/alternates'))
    expect(() => resolvePrimary(target, git)).toThrow('must borrow')
  })

  it('rejects unrelated repositories before copying anything', () => {
    sourceOrigin = 'git@github.com:someone/third-party.git'
    expect(main([], { root: target, git, log, error: log })).toBe(1)
    expect(fs.existsSync(path.join(target, '.env'))).toBe(false)
    expect(log.mock.calls.flat().join('\n')).not.toContain(SENTINEL)
  })

  it.each(['source-file', 'target-file', 'source-parent', 'target-parent', 'dangling-target'])(
    'rejects %s symlinks even with force before any copy', (kind: string) => {
      const root = kind.startsWith('source') ? source : target
      const relative = kind.endsWith('parent') ? '.secrets' : '.env.e2e'
      fs.rmSync(path.join(root, relative), { recursive: true, force: true })
      const outside = path.join(scratch, kind.endsWith('parent') ? 'outside-directory' : 'outside-file')
      if (kind.endsWith('parent')) fs.mkdirSync(outside)
      else if (kind !== 'dangling-target') fs.writeFileSync(outside, SENTINEL)
      fs.symlinkSync(outside, path.join(root, relative))
      expect(() => bootstrap({ root: target, git, log, force: true, androidSecrets: true })).toThrow('symlink')
      expect(fs.existsSync(path.join(target, '.env'))).toBe(false)
    },
  )

  it.each(['source-tracked', 'target-tracked', 'source-unignored', 'target-unignored'])(
    'rejects %s paths in the complete preflight before writing an earlier allowed file', (kind: string) => {
      const root = kind.startsWith('source') ? source : target
      ;(kind.endsWith('unignored') ? nonIgnored : tracked).add(`${root}:.env.e2e`)
      expect(() => bootstrap({ root: target, git, log })).toThrow(/tracked|ignored/)
      expect(fs.existsSync(path.join(target, '.env'))).toBe(false)
    },
  )

  const ignoredRecords = ENV_FILES.map((relative: string) => ['.gitignore', '1', '**', relative, ''].join('\0')).join('')
  const firstIgnoredRecord = ['.gitignore', '1', '**', '.env', ''].join('\0')
  it.each([
    { label: 'unterminated tracked path', command: 'ls-files', override: { stdout: '.env' } },
    { label: 'unexpected tracked path', command: 'ls-files', override: { stdout: `${SENTINEL}\0` } },
    { label: 'duplicate tracked path', command: 'ls-files', override: { stdout: '.env\0.env\0' } },
    { label: 'tracked subprocess failure', command: 'ls-files', override: { status: 128, stdout: SENTINEL } },
    { label: 'negated ignore pattern', command: 'check-ignore', override: { stdout: ignoredRecords.replace('**', '!**') } },
    { label: 'unterminated ignore record', command: 'check-ignore', override: { stdout: ignoredRecords.slice(0, -1) } },
    { label: 'missing ignore record', command: 'check-ignore', override: { stdout: ignoredRecords.slice(firstIgnoredRecord.length) } },
    { label: 'duplicate ignore path', command: 'check-ignore', override: { stdout: ignoredRecords.replace('.env.prod\0', '.env\0') } },
    { label: 'unexpected ignore path', command: 'check-ignore', override: { stdout: ignoredRecords.replace('.env\0', `${SENTINEL}\0`) } },
    { label: 'invalid ignore line', command: 'check-ignore', override: { stdout: ignoredRecords.replace(['1', '**'].join('\0'), ['0', '**'].join('\0')) } },
    { label: 'unignored subprocess status', command: 'check-ignore', override: { status: 1 } },
    { label: 'ignore subprocess failure', command: 'check-ignore', override: { status: 128, stdout: SENTINEL } },
    { label: 'signaled ignore subprocess', command: 'check-ignore', override: { signal: 'SIGTERM' } },
    { label: 'ignore subprocess error', command: 'check-ignore', override: { error: new Error(SENTINEL) } },
  ])('rejects $label before copying and without echoing Git output', ({ command, override }) => {
    const brokenGit = (root: string, args: string[], input?: string) => {
      const result = git(root, args, input)
      return root === source && args[0] === command ? { ...result, ...override } : result
    }
    expect(main([], { root: target, git: brokenGit, log, error: log })).toBe(1)
    expect(fs.existsSync(path.join(target, '.env'))).toBe(false)
    expect(log.mock.calls.flat().join('\n')).not.toContain(SENTINEL)
  })

  it('refuses a source font bundle incompatible with the target revision before env writes', () => {
    fonts()
    write(target, 'workers/book-renderer/fonts.lock.json', '{}')
    expect(main([], { root: target, git, log, error: log })).toBe(1)
    expect(fs.existsSync(path.join(target, '.env'))).toBe(false)
    expect(log.mock.calls.flat().join('\n')).not.toContain(SENTINEL)
  })

  it('does not echo unexpected error details or unknown CLI arguments', () => {
    expect(main([], { root: target, git: () => { throw new Error(SENTINEL) }, log, error: log })).toBe(1)
    expect(main([SENTINEL], { log, error: log })).toBe(1)
    expect(log.mock.calls.flat().join('\n')).not.toContain(SENTINEL)
    expect(main(['--help'], { log, error: log })).toBe(0)
  })
})
