/**
 * Regression tests for scripts/ensure-node-version.js
 *
 * The version gate is correct to refuse an unsupported Node, but its advice
 * used to name `nvm` unconditionally. On a Homebrew-only workstation there is
 * no nvm at all while a supported Node sits in /opt/homebrew/opt/node@22/bin,
 * so a production deploy failed with instructions that could not be followed.
 * The gate must still refuse — it must just name a Node that actually exists.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const {
  assertSupportedNode,
  buildUnsupportedMessage,
  candidateBinDirs,
  findSupportedNodeHint,
  isSupportedVersion,
} = require('@/scripts/ensure-node-version')

/** Fake `node -v` that answers per bin directory and throws for unknown ones. */
const execFor = (versions: Record<string, string>) =>
  jest.fn((binary: string) => {
    const version = versions[path.dirname(binary)]
    if (!version) throw new Error(`ENOENT ${binary}`)
    return version
  })

describe('isSupportedVersion', () => {
  it('accepts the pinned minimum and later Node 22 patches', () => {
    expect(isSupportedVersion('v22.13.1')).toBe(true)
    expect(isSupportedVersion('v22.23.1')).toBe(true)
    expect(isSupportedVersion('22.14.0')).toBe(true)
  })

  it('rejects older Node 22, other majors and unparsable input', () => {
    expect(isSupportedVersion('v22.12.0')).toBe(false)
    expect(isSupportedVersion('v20.20.2')).toBe(false)
    expect(isSupportedVersion('v26.4.0')).toBe(false)
    expect(isSupportedVersion('not-a-version')).toBe(false)
    expect(isSupportedVersion('')).toBe(false)
  })
})

describe('candidateBinDirs', () => {
  it('honours NVM_DIR over the default home location', () => {
    const readdir = jest.spyOn(fs, 'readdirSync').mockImplementation(((dir: string) =>
      String(dir).includes(path.join('custom-nvm', 'versions', 'node')) ? ['v22.13.1'] : []) as never)

    const dirs = candidateBinDirs({ NVM_DIR: '/custom-nvm' }, '/home/u')

    expect(dirs).toContain(path.join('/custom-nvm', 'versions', 'node', 'v22.13.1', 'bin'))
    readdir.mockRestore()
  })

  it('includes Homebrew node kegs and never repeats a directory', () => {
    const readdir = jest.spyOn(fs, 'readdirSync').mockImplementation(((dir: string) =>
      String(dir) === '/opt/homebrew/opt' ? ['node', 'node@20', 'node@22', 'python@3'] : []) as never)

    const dirs = candidateBinDirs({}, '/home/u')

    expect(dirs).toContain('/opt/homebrew/opt/node@22/bin')
    expect(dirs).toContain('/opt/homebrew/opt/node/bin')
    expect(dirs).not.toContain('/opt/homebrew/opt/python@3/bin')
    expect(new Set(dirs).size).toBe(dirs.length)
    readdir.mockRestore()
  })

  it('survives unreadable directories instead of throwing', () => {
    const readdir = jest.spyOn(fs, 'readdirSync').mockImplementation((() => {
      throw new Error('EACCES')
    }) as never)

    // Only volta's fixed bin path survives — it needs no directory listing, and
    // an absent binary there is rejected later by the probe, not here.
    expect(() => candidateBinDirs({}, '/home/u')).not.toThrow()
    expect(candidateBinDirs({}, '/home/u')).toEqual([path.join('/home/u', '.volta', 'bin')])
    readdir.mockRestore()
  })
})

describe('findSupportedNodeHint', () => {
  const mockLayout = (entries: Record<string, string[]>) =>
    jest.spyOn(fs, 'readdirSync').mockImplementation(((dir: string) => entries[String(dir)] ?? []) as never)

  it('reports a keg whose real version satisfies the range', () => {
    const readdir = mockLayout({ '/opt/homebrew/opt': ['node@22'] })
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    const exec = execFor({ '/opt/homebrew/opt/node@22/bin': 'v22.23.1\n' })

    expect(findSupportedNodeHint({ env: {}, homeDir: '/home/u', exec })).toEqual({
      version: 'v22.23.1',
      binDir: '/opt/homebrew/opt/node@22/bin',
    })

    readdir.mockRestore()
    exists.mockRestore()
  })

  it('ignores a candidate whose real version is out of range', () => {
    // Directory name says node@22 but the binary reports Node 20 — the probe wins.
    const readdir = mockLayout({ '/opt/homebrew/opt': ['node@22'] })
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    const exec = execFor({ '/opt/homebrew/opt/node@22/bin': 'v20.20.2\n' })

    expect(findSupportedNodeHint({ env: {}, homeDir: '/home/u', exec })).toBeNull()

    readdir.mockRestore()
    exists.mockRestore()
  })

  it('returns null when nothing supported is installed', () => {
    const readdir = mockLayout({})
    const exec = execFor({})

    expect(findSupportedNodeHint({ env: {}, homeDir: '/home/u', exec })).toBeNull()
    expect(exec).not.toHaveBeenCalled()

    readdir.mockRestore()
  })

  it('does not run a binary that is not on disk', () => {
    const readdir = mockLayout({ '/opt/homebrew/opt': ['node@22'] })
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
    const exec = execFor({ '/opt/homebrew/opt/node@22/bin': 'v22.23.1\n' })

    expect(findSupportedNodeHint({ env: {}, homeDir: '/home/u', exec })).toBeNull()
    expect(exec).not.toHaveBeenCalled()

    readdir.mockRestore()
    exists.mockRestore()
  })
})

describe('buildUnsupportedMessage', () => {
  it('prints a copyable PATH command when a supported Node exists', () => {
    const message = buildUnsupportedMessage('v20.20.2', {
      version: 'v22.23.1',
      binDir: '/opt/homebrew/opt/node@22/bin',
    })

    expect(message).toContain('Unsupported Node.js v20.20.2.')
    expect(message).toContain('Found Node v22.23.1 at /opt/homebrew/opt/node@22/bin')
    expect(message).toContain('export PATH="/opt/homebrew/opt/node@22/bin:$PATH"')
    expect(message).not.toContain('nvm use')
  })

  it('falls back to the generic advice when nothing was found', () => {
    const message = buildUnsupportedMessage('v20.20.2', null)

    expect(message).toContain('nvm use')
    expect(message).not.toContain('Found Node')
  })
})

describe('assertSupportedNode', () => {
  it('stays a gate: an unsupported Node still throws', () => {
    expect(() =>
      assertSupportedNode('v20.20.2', { env: {}, homeDir: '/home/u', exec: execFor({}) }),
    ).toThrow(/Unsupported Node\.js v20\.20\.2/)
  })

  it('tags the failure so callers can branch on it', () => {
    try {
      assertSupportedNode('v20.20.2', { env: {}, homeDir: '/home/u', exec: execFor({}) })
      throw new Error('expected assertSupportedNode to throw')
    } catch (error) {
      expect((error as NodeJS.ErrnoException).code).toBe('ERR_UNSUPPORTED_NODE_VERSION')
    }
  })

  it('passes on a supported Node without probing the filesystem', () => {
    const readdir = jest.spyOn(fs, 'readdirSync')

    expect(() => assertSupportedNode('v22.13.1')).not.toThrow()
    expect(readdir).not.toHaveBeenCalled()

    readdir.mockRestore()
  })

  it('accepts the Node this suite is running on', () => {
    expect(() => assertSupportedNode(process.version)).not.toThrow()
    expect(os.homedir()).toBeTruthy()
  })
})
