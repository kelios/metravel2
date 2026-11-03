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

  // Book files live in S3 (#2971): a release holds only the pointer.
  it('accepts a release that carries only the publication pointer', () => {
    const client = path.join(root, 'releases/s3/client')
    write(path.join(client, 'travel-books/manifest.json'), '{}')
    const result = run(['books', client, path.join(root, 'shared/travel-books')])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('📊 Книги релиза: только manifest.json, файлы — в S3; прежнего хранилища web-ssr/shared/travel-books нет')
  })

  it.each([
    ['a book file', 'travel-books/book/r1/read.pdf'],
    ['an empty revision directory', 'travel-books/book/r1/'],
  ])('stops the deploy when the release carries %s', (_label, relative) => {
    const client = path.join(root, 'releases/bad/client')
    write(path.join(client, 'travel-books/manifest.json'), '{}')
    if (relative.endsWith('/')) fs.mkdirSync(path.join(client, relative), { recursive: true })
    else write(path.join(client, relative), '%PDF-x')
    const result = run(['books', client, path.join(root, 'shared/travel-books')])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('❌ Релиз запечатан, но не опубликован')
    expect(result.stderr).toContain('travel-books/book')
  })

  // Releases staged before #2971 hold their books as hard links into the store.
  // The store drains as finalize removes them, per inode: equal content is one
  // inode under several paths, so a link count alone would keep or drop it wrongly.
  it('drains the former store as releases with books leave, then removes it', () => {
    const store = path.join(root, 'shared/travel-books')
    const old = path.join(root, 'releases/old/client/travel-books')
    const font = write(path.join(old, 'book/r1/font.ttf'), 'font')
    fs.mkdirSync(path.join(old, 'book/r2'), { recursive: true })
    fs.linkSync(font, path.join(old, 'book/r2/font.ttf'))
    const read = write(path.join(old, 'book/r1/read.pdf'), '%PDF-old')
    fs.mkdirSync(path.join(store, 'book/r1'), { recursive: true })
    fs.mkdirSync(path.join(store, 'book/r2'), { recursive: true })
    fs.linkSync(font, path.join(store, 'book/r1/font.ttf'))
    fs.linkSync(font, path.join(store, 'book/r2/font.ttf'))
    fs.linkSync(read, path.join(store, 'book/r1/read.pdf'))
    write(path.join(store, 'book/r0/orphan.pdf'), '%PDF-orphan')

    const client = path.join(root, 'releases/new/client')
    write(path.join(client, 'travel-books/manifest.json'), '{}')
    const kept = run(['books', client, store])
    expect(kept.status).toBe(0)
    expect(kept.stdout).toContain('прежнее хранилище web-ssr/shared/travel-books: 3 файлов')
    expect(fs.existsSync(path.join(store, 'book/r0'))).toBe(false)
    expect(fs.existsSync(path.join(store, 'book/r2/font.ttf'))).toBe(true)

    fs.rmSync(path.join(root, 'releases/old'), { recursive: true })
    const drained = run(['books', client, store])
    expect(drained.status).toBe(0)
    expect(drained.stdout).toContain('прежнего хранилища web-ssr/shared/travel-books нет')
    expect(fs.existsSync(store)).toBe(false)
  })

  // The host receives the helper over `bash -s`: no command may read the rest
  // of the script from the inherited stdin.
  it('runs to its report when the script itself arrives on stdin', () => {
    const client = path.join(root, 'releases/piped/client')
    write(path.join(client, 'travel-books/manifest.json'), '{}')
    write(path.join(root, 'shared/travel-books/book/r1/orphan.pdf'), '%PDF-piped')
    const result = runCli('bash', ['-c', `bash -s -- books "$0" "$1" < "${helper}"`, client, path.join(root, 'shared/travel-books')])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('прежнего хранилища web-ssr/shared/travel-books нет')
  })

  it('reports a release without books and refuses a symlinked store', () => {
    const client = path.join(root, 'releases/none/client')
    fs.mkdirSync(client, { recursive: true })
    expect(run(['books', client, path.join(root, 'shared/travel-books')]).status).toBe(0)

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
