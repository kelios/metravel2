/** @jest-environment node */
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { privatePath, readBoundedBytes, readBoundedJson } from '@/workers/book-renderer/filesystem'

describe('private bounded book source reads', () => {
  let scratch: string
  beforeAll(async () => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await mkdir(root, { recursive: true })
    scratch = await mkdtemp(path.join(root, 'book-private-files-'))
  })
  afterAll(async () => { await rm(scratch, { recursive: true, force: true }) })

  it('accepts a bounded Unicode JSON record and rejects bytes beyond its declared limit', async () => {
    const file = path.join(scratch, 'record.json')
    const value = { title: 'ёжик 😀' }
    const bytes = Buffer.from(JSON.stringify(value))
    await writeFile(file, bytes)
    expect(await readBoundedJson(file, bytes.length)).toEqual(value)
    await expect(readBoundedJson(file, bytes.length - 1)).rejects.toThrow('WORKER_RECORD_BUDGET_EXCEEDED')
    await expect(readBoundedBytes(scratch)).rejects.toThrow('WORKER_SOURCE_INVALID')
  })

  it('rejects leaf and ancestor symlinks even when their target stays inside the private root', async () => {
    await mkdir(path.join(scratch, 'sources'))
    await writeFile(path.join(scratch, 'sources', 'source'), 'pinned bytes')
    await symlink(path.join(scratch, 'sources', 'source'), path.join(scratch, 'linked-source'))
    await symlink(path.join(scratch, 'sources'), path.join(scratch, 'linked-directory'))
    expect(await privatePath(scratch, 'sources/source')).toBe(path.join(scratch, 'sources', 'source'))
    for (const ref of ['linked-source', 'linked-directory/source', '../outside', path.join(scratch, 'sources', 'source')]) {
      await expect(privatePath(scratch, ref)).rejects.toThrow('SNAPSHOT_PRIVATE_PATH_INVALID')
    }
  })
})
