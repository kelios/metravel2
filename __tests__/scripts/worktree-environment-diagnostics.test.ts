/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir } from './cli-test-utils'

const { applyE2EEnvFiles } = require('../../scripts/e2e-env-files')
const { verifiedFontBundle } = require('../../scripts/prepare-book-renderer-fonts')

describe('worktree prerequisite diagnostics', () => {
  let scratch: string
  let warning: jest.SpyInstance
  const key = 'WORKTREE_DIAGNOSTIC_FIXTURE'
  const original = process.env[key]

  beforeEach(() => {
    const base = path.resolve('.codex-temp/tests')
    fs.mkdirSync(base, { recursive: true })
    scratch = makeTempDir('worktree-diagnostics-', { root: base })
    warning = jest.spyOn(console, 'warn').mockImplementation(() => {})
    delete process.env[key]
  })

  afterEach(() => {
    warning.mockRestore()
    if (original === undefined) delete process.env[key]
    else process.env[key] = original
    fs.rmSync(scratch, { recursive: true, force: true })
  })

  it('explains missing E2E prerequisites without exposing loaded content', () => {
    const sentinel = 'private-fixture-content'
    fs.writeFileSync(path.join(scratch, '.env'), `${key}=${sentinel}\n`)
    applyE2EEnvFiles(scratch)
    expect(process.env[key]).toBe(sentinel)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('npm run worktree:bootstrap'))
    expect(JSON.stringify(warning.mock.calls)).not.toContain(sentinel)
  })

  it('preserves E2E-file priority and explicit environment overrides', () => {
    fs.writeFileSync(path.join(scratch, '.env'), `${key}=base\n`)
    fs.writeFileSync(path.join(scratch, '.env.e2e'), `${key}=e2e\n`)
    applyE2EEnvFiles(scratch)
    expect(process.env[key]).toBe('e2e')
    process.env[key] = 'explicit'
    applyE2EEnvFiles(scratch)
    expect(process.env[key]).toBe('explicit')
    expect(warning).not.toHaveBeenCalled()
  })

  it('gives preparation guidance instead of a raw missing-font filesystem error', () => {
    expect(() => verifiedFontBundle(scratch)).toThrow('npm run worktree:bootstrap')
  })
})
