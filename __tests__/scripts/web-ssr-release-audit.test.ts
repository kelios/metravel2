/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const helper = path.resolve(process.cwd(), 'scripts/web-ssr-release-audit.sh')
const stamp = new Date('2024-01-01T00:00:00Z')

function write(file: string, content: string | Buffer, mtime = stamp): string {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  fs.utimesSync(file, mtime, mtime)
  return file
}

function run(args: string[]) {
  return runCli('bash', [helper, ...args])
}

describe('web-ssr-release-audit books', () => {
  let root: string
  beforeEach(() => { root = makeTempDir('ssr-audit-') })
  afterEach(() => removeDir(root))

  // The first release after #2857 brings every book; the store is built from
  // it by hard links, so the release and the store share one copy on disk.
  it('links the books of a fresh release into the store and skips the pointer', () => {
    const client = path.join(root, 'releases/first/client')
    const store = path.join(root, 'shared/travel-books')
    const read = write(path.join(client, 'travel-books/book/r1/read.pdf'), '%PDF-first')
    write(path.join(client, 'travel-books/book/r1/cover.webp'), 'RIFF0000WEBP')
    write(path.join(client, 'travel-books/manifest.json'), '{}', new Date())

    const result = run(['books', client, store])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('📊 Книги релиза: 3 файлов')
    expect(result.stdout).toContain('загружено заново 2 (')
    expect(fs.statSync(path.join(store, 'book/r1/read.pdf')).ino).toBe(fs.statSync(read).ino)
    expect(fs.statSync(read).nlink).toBe(2)
    expect(fs.existsSync(path.join(store, 'manifest.json'))).toBe(false)
    expect(fs.existsSync(path.join(store, 'book/r1/cover.webp'))).toBe(true)
  })

  // The next release arrives with its unchanged books already linked from
  // the store (rsync --link-dest); only a new revision is new to the store.
  // Once finalize removes the old release, the files nobody references leave.
  it('adds new revisions, keeps shared files and prunes unreferenced ones', () => {
    const store = path.join(root, 'shared/travel-books')
    const first = path.join(root, 'releases/first/client')
    write(path.join(first, 'travel-books/book/r1/read.pdf'), '%PDF-first')
    write(path.join(first, 'travel-books/book/r1/only-first.pdf'), '%PDF-only')
    expect(run(['books', first, store]).status).toBe(0)

    const second = path.join(root, 'releases/second/client')
    fs.mkdirSync(path.join(second, 'travel-books/book/r1'), { recursive: true })
    fs.linkSync(path.join(store, 'book/r1/read.pdf'), path.join(second, 'travel-books/book/r1/read.pdf'))
    write(path.join(second, 'travel-books/book/r2/read.pdf'), '%PDF-second')
    const result = run(['books', second, store])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('📊 Книги релиза: 2 файлов')
    expect(result.stdout).toContain('загружено заново 1 (')
    expect(fs.existsSync(path.join(store, 'book/r1/only-first.pdf'))).toBe(true)
    expect(fs.statSync(path.join(store, 'book/r2/read.pdf')).ino).toBe(fs.statSync(path.join(second, 'travel-books/book/r2/read.pdf')).ino)

    fs.rmSync(path.join(root, 'releases/first'), { recursive: true })
    expect(run(['books', second, store]).status).toBe(0)
    expect(fs.existsSync(path.join(store, 'book/r1/only-first.pdf'))).toBe(false)
    expect(fs.existsSync(path.join(store, 'book/r1/read.pdf'))).toBe(true)
    expect(fs.existsSync(path.join(store, 'book/r2/read.pdf'))).toBe(true)
    expect(fs.statSync(path.join(store, 'book/r1/read.pdf')).nlink).toBe(2)
  })

  // copy-publication.cjs hard-links equal content inside one build, so a
  // book file is often one inode under several paths. The link count then
  // says neither what was uploaded nor what only the store still holds.
  it('counts and prunes hard-linked duplicates per inode', () => {
    const store = path.join(root, 'shared/travel-books')
    const first = path.join(root, 'releases/first/client')
    const font = write(path.join(first, 'travel-books/book/r1/font.ttf'), 'font')
    fs.mkdirSync(path.join(first, 'travel-books/book/r2'), { recursive: true })
    fs.linkSync(font, path.join(first, 'travel-books/book/r2/font.ttf'))
    const firstRun = run(['books', first, store])
    expect(firstRun.status).toBe(0)
    expect(firstRun.stdout).toContain('📊 Книги релиза: 2 файлов')
    expect(firstRun.stdout).toContain('загружено заново 1 (')

    const second = path.join(root, 'releases/second/client')
    write(path.join(second, 'travel-books/book/r3/read.pdf'), '%PDF-third')
    expect(run(['books', second, store]).status).toBe(0)
    expect(fs.existsSync(path.join(store, 'book/r1/font.ttf'))).toBe(true)

    fs.rmSync(path.join(root, 'releases/first'), { recursive: true })
    expect(run(['books', second, store]).status).toBe(0)
    expect(fs.existsSync(path.join(store, 'book/r1'))).toBe(false)
    expect(fs.existsSync(path.join(store, 'book/r2'))).toBe(false)
    expect(fs.existsSync(path.join(store, 'book/r3/read.pdf'))).toBe(true)
  })

  // The host receives the helper over `bash -s`: no command may read the rest
  // of the script from the inherited stdin.
  it('runs to its report when the script itself arrives on stdin', () => {
    const client = path.join(root, 'releases/piped/client')
    write(path.join(client, 'travel-books/book/r1/read.pdf'), '%PDF-piped')
    const result = runCli('bash', ['-c', `bash -s -- books "$0" "$1" < "${helper}"`, client, path.join(root, 'shared/travel-books')])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('📊 Книги релиза: 1 файлов')
  })

  it('reports a release without books and refuses a symlinked store', () => {
    const client = path.join(root, 'releases/none/client')
    fs.mkdirSync(client, { recursive: true })
    const none = run(['books', client, path.join(root, 'shared/travel-books')])
    expect(none.status).toBe(0)
    expect(none.stdout).toContain('в релизе нет каталога travel-books')

    write(path.join(client, 'travel-books/book/r1/read.pdf'), '%PDF-x')
    fs.mkdirSync(path.join(root, 'elsewhere'))
    fs.symlinkSync(path.join(root, 'elsewhere'), path.join(root, 'linked-store'))
    const linked = run(['books', client, path.join(root, 'linked-store')])
    expect(linked.status).toBe(1)
    expect(linked.stderr).toContain('must not be a symlink')
  })
})

describe('web-ssr-release-audit chunks', () => {
  let root: string
  beforeEach(() => { root = makeTempDir('ssr-audit-') })
  afterEach(() => removeDir(root))

  function release(files: number, kib: number): string {
    const client = path.join(root, 'client')
    for (let index = 0; index < files; index += 1) {
      write(path.join(client, `_expo/static/js/web/chunk-${index}.js`), 'x'.repeat(kib * 1024))
    }
    return client
  }

  it('reports the sealed chunk directory against twice the export plus the overlay budget', () => {
    const client = release(3, 512)
    const result = run(['chunks', client, '1024', '2'])
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/📊 Чанки релиза на проде: 3 js-файлов, 2 МБ в _expo\/static\/js \(свежий экспорт 1 МБ, предел 4 МБ: 2 × свежий экспорт \+ overlay 2 МБ\)/)
  })

  it('stops the deploy above the limit and honours an explicit one', () => {
    const client = release(4, 1024)
    const over = run(['chunks', client, '1024', '1'])
    expect(over.status).toBe(1)
    expect(over.stdout).toContain('предел 3 МБ')
    expect(over.stdout).toContain('❌ Релиз запечатан, но не опубликован')
    expect(over.stdout).toContain('docs/ops/prod-disk-growth.md')

    const explicit = run(['chunks', client, '1024', '1', '700'])
    expect(explicit.status).toBe(0)
    expect(explicit.stdout).toContain('предел 700 МБ: задан явно')
  })

  it('rejects malformed arguments and a missing chunk directory', () => {
    expect(run(['chunks', root, 'x', '1']).status).toBe(2)
    expect(run(['chunks', root, '1', '1']).status).toBe(1)
    expect(run(['nothing']).status).toBe(2)
  })
})
