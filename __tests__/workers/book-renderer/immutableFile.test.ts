/** @jest-environment node */
const filesystem: typeof import('node:fs/promises') = require('node:fs/promises')
import { constants } from 'node:fs'
import path from 'node:path'
import { publishImmutableFile } from '@/workers/book-renderer/immutableFile'
import { sha256 } from '@/workers/book-renderer/filesystem'

describe('durable immutable print-cache publication', () => {
  let scratch: string
  beforeEach(async () => {
    const root = path.resolve(__dirname, '../../../.codex-temp/tests')
    await filesystem.mkdir(root, { recursive: true })
    scratch = await filesystem.mkdtemp(path.join(root, 'immutable-print-'))
    await filesystem.mkdir(path.join(scratch, 'cache'), { mode: 0o700 })
  })
  afterEach(async () => { jest.restoreAllMocks(); await filesystem.rm(scratch, { recursive: true, force: true }) })

  it('preserves exact bytes and accepts an immutable retry without rewriting the existing inode', async () => {
    const bytes = Buffer.from([0, 128, 255, 1, 2, 3])
    const first = await publishImmutableFile(scratch, 'cache/image', bytes, bytes.length)
    const before = await filesystem.stat(path.join(scratch, 'cache/image'))
    const retry = await publishImmutableFile(scratch, 'cache/image', bytes, bytes.length)
    const after = await filesystem.stat(path.join(scratch, 'cache/image'))
    expect(first).toEqual({ checksum: sha256(bytes), size_bytes: bytes.length })
    expect(retry).toEqual(first)
    expect(after.ino).toBe(before.ino); expect(after.mtimeMs).toBe(before.mtimeMs)
    expect(after.mode & 0o777).toBe(0o600)
    expect(await filesystem.readFile(path.join(scratch, 'cache/image'))).toEqual(bytes)
    expect(await filesystem.readdir(path.join(scratch, 'cache'))).toEqual(['image'])
  })

  it('views the caller-owned encoded binary without an extra full-size Buffer copy', async () => {
    const payload = Buffer.alloc(8 * 1024 * 1024, 7)
    const from = jest.spyOn(Buffer, 'from')
    await publishImmutableFile(scratch, 'cache/large-image', payload, payload.length)
    const calls = from.mock.calls as unknown as unknown[][]
    expect(calls.some(args => args[0] === payload)).toBe(false)
    expect(calls.some(args => args[0] === payload.buffer && args[1] === payload.byteOffset && args[2] === payload.byteLength)).toBe(true)
    expect((await filesystem.stat(path.join(scratch, 'cache/large-image'))).size).toBe(payload.length)
  })

  it('rejects caller mutation across awaited IO before publishing the canonical file', async () => {
    const payload = Buffer.from('original')
    const open = filesystem.open
    let changed = false
    jest.spyOn(filesystem, 'open').mockImplementation(async (...args: Parameters<typeof filesystem.open>) => {
      if (typeof args[0] === 'string' && args[0].includes('/.pending-') && !changed) {
        changed = true; payload.fill(0)
      }
      return open(...args)
    })
    await expect(publishImmutableFile(scratch, 'cache/image', payload, payload.length)).rejects.toThrow('WORKER_IMMUTABLE_INTEGRITY_FAILED')
    expect(await filesystem.readdir(path.join(scratch, 'cache'))).toEqual([])
    jest.restoreAllMocks()
    await publishImmutableFile(scratch, 'cache/image', 'original', 8)
    expect(await filesystem.readFile(path.join(scratch, 'cache/image'), 'utf8')).toBe('original')
  })

  it('cannot poison a retry when a crash occurs after the temporary file fsync but before atomic publication', async () => {
    const link = jest.spyOn(filesystem, 'link').mockRejectedValueOnce(new Error('SIMULATED_PREPUBLISH_CRASH'))
    await expect(publishImmutableFile(scratch, 'cache/image', 'original', 8)).rejects.toThrow('SIMULATED_PREPUBLISH_CRASH')
    expect(await filesystem.readdir(path.join(scratch, 'cache'))).toEqual([])
    link.mockRestore()
    await publishImmutableFile(scratch, 'cache/image', 'original', 8)
    expect(await filesystem.readFile(path.join(scratch, 'cache/image'), 'utf8')).toBe('original')
  })

  it('verifies and retries the complete leaf after publication succeeds but its first directory fsync fails', async () => {
    const open = filesystem.open
    let failed = false
    jest.spyOn(filesystem, 'open').mockImplementation(async (...args: Parameters<typeof filesystem.open>) => {
      if (args[0] === path.join(scratch, 'cache') && !failed) { failed = true; throw new Error('SIMULATED_DIRECTORY_SYNC_CRASH') }
      return open(...args)
    })
    await expect(publishImmutableFile(scratch, 'cache/image', 'complete', 8)).rejects.toThrow('SIMULATED_DIRECTORY_SYNC_CRASH')
    expect(await filesystem.readFile(path.join(scratch, 'cache/image'), 'utf8')).toBe('complete')
    jest.restoreAllMocks()
    await publishImmutableFile(scratch, 'cache/image', 'complete', 8)
    expect(await filesystem.readdir(path.join(scratch, 'cache'))).toEqual(['image'])
  })

  it.each(['short', 'same-size'])('rejects a pre-existing %s partial/conflicting leaf without replacing or quarantining it', async kind => {
    const wrong = kind === 'short' ? 'part' : 'mismatch'
    const leaf = path.join(scratch, 'cache/image')
    await filesystem.writeFile(leaf, wrong, { mode: 0o600 })
    const before = await filesystem.stat(leaf)
    await expect(publishImmutableFile(scratch, 'cache/image', 'complete', 8)).rejects.toThrow('WORKER_IMMUTABLE_INTEGRITY_FAILED')
    expect(await filesystem.readFile(leaf, 'utf8')).toBe(wrong)
    expect((await filesystem.stat(leaf)).ino).toBe(before.ino)
    expect(await filesystem.readdir(path.join(scratch, 'cache'))).toEqual(['image'])
  })

  it('checks string byte limits before any temporary or canonical write', async () => {
    const open = jest.spyOn(filesystem, 'open')
    const before = await filesystem.readdir(scratch, { recursive: true })
    await expect(publishImmutableFile(scratch, 'cache/large', '😀'.repeat(8), 31)).rejects.toThrow('WORKER_IMMUTABLE_BYTE_LIMIT')
    expect(open).not.toHaveBeenCalled()
    expect(await filesystem.readdir(scratch, { recursive: true })).toEqual(before)
  })

  it.each(['root', 'directory', 'leaf', 'dangling-leaf'])('rejects %s symlinks before writing any temporary file', async kind => {
    const external = path.join(scratch, 'external')
    await filesystem.mkdir(external, { mode: 0o700 })
    const payload = path.join(external, 'original')
    await filesystem.writeFile(payload, 'secret', { mode: 0o600 })
    let root = scratch
    let ref = 'cache/image'
    if (kind === 'root') { root = path.join(scratch, 'root-link'); await filesystem.symlink(external, root); ref = 'image' }
    else if (kind === 'directory') { await filesystem.rm(path.join(scratch, 'cache'), { recursive: true }); await filesystem.symlink(external, path.join(scratch, 'cache')) }
    else await filesystem.symlink(kind === 'leaf' ? payload : path.join(external, 'missing'), path.join(scratch, 'cache/image'))
    const open = jest.spyOn(filesystem, 'open')
    await expect(publishImmutableFile(root, ref, 'public', 6)).rejects.toThrow('WORKER_IMMUTABLE_PATH_INVALID')
    expect(open).not.toHaveBeenCalled()
    expect(await filesystem.readFile(payload, 'utf8')).toBe('secret')
  })

  it.each(['directory', 'leaf'])('rejects a public %s mode without repairing unrelated permissions', async kind => {
    const target = path.join(scratch, 'cache', ...(kind === 'leaf' ? ['image'] : []))
    if (kind === 'leaf') { await filesystem.writeFile(target, 'complete', { mode: 0o644 }); await filesystem.chmod(target, 0o644) }
    else await filesystem.chmod(target, 0o755)
    await expect(publishImmutableFile(scratch, 'cache/image', 'complete', 8)).rejects.toThrow('WORKER_IMMUTABLE_PATH_INVALID')
    expect((await filesystem.stat(target)).mode & 0o777).toBe(kind === 'leaf' ? 0o644 : 0o755)
  })

  it('uses exclusive no-follow creation and fsyncs both file and directory', async () => {
    const open = filesystem.open
    const flags: number[] = []
    let fileSyncs = 0
    let directorySyncs = 0
    jest.spyOn(filesystem, 'open').mockImplementation(async (...args: Parameters<typeof filesystem.open>) => {
      if (typeof args[1] === 'number') flags.push(args[1])
      const handle = await open(...args)
      const sync = handle.sync.bind(handle)
      jest.spyOn(handle, 'sync').mockImplementation(async () => {
        if (args[0] === path.join(scratch, 'cache')) directorySyncs++; else fileSyncs++
        return sync()
      })
      return handle
    })
    await publishImmutableFile(scratch, 'cache/image', 'complete', 8)
    expect(flags[0] & constants.O_EXCL).toBe(constants.O_EXCL)
    expect(flags[0] & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW)
    expect(fileSyncs).toBe(1); expect(directorySyncs).toBe(2)
  })
})
