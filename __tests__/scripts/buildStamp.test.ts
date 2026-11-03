/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'

import { makeTempDir, removeDir, runCli, writeTextFile } from './cli-test-utils'

const { commitTimeMs, resolveBuildTimeMs } = require('@/scripts/lib/buildStamp')

// #2930: две сборки одного sha дают одинаковые отметки — иначе сервер
// отклоняет повторный выкат того же sha после отката (digest релиза).
describe('build stamps (#2930)', () => {
  let repo: string

  beforeEach(() => {
    repo = makeTempDir('build-stamp-')
    const env = { GIT_COMMITTER_DATE: '2026-11-01T19:05:20Z', GIT_AUTHOR_DATE: '2026-11-01T19:05:20Z' }
    const git = (args: string[]) => {
      const result = runCli('git', args, { cwd: repo, env })
      if (result.status !== 0) throw new Error(result.stderr)
    }
    git(['init', '-q'])
    writeTextFile(path.join(repo, 'a.txt'), 'a')
    git(['add', 'a.txt'])
    git(['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'a'])
  })

  afterEach(() => removeDir(repo))

  it('takes the commit time, not the wall clock, for every build of one sha', () => {
    const expected = Date.parse('2026-11-01T19:05:20Z')
    const now = jest.fn(() => 1)
    expect(resolveBuildTimeMs({ cwd: repo, now })).toBe(expected)
    expect(resolveBuildTimeMs({ cwd: repo, now })).toBe(expected)
    expect(now).not.toHaveBeenCalled()
  })

  it('falls back to the wall clock outside a git checkout', () => {
    const outside = makeTempDir('build-stamp-nogit-', { root: fs.realpathSync(require('node:os').tmpdir()) })
    try {
      expect(commitTimeMs('HEAD', outside)).toBeNull()
      expect(resolveBuildTimeMs({ cwd: outside, now: () => 42 })).toBe(42)
    } finally {
      removeDir(outside)
    }
  })

  it('stamps build-version in HTML from the commit time of the build source', () => {
    const dist = makeTempDir('build-stamp-dist-')
    try {
      const page = path.join(dist, 'index.html')
      writeTextFile(page, '<html><head><meta charset="utf-8"><title>t</title></head><body></body></html>')
      const { processDirectory } = require('@/scripts/add-cache-bust-meta')
      processDirectory(dist)
      expect(fs.readFileSync(page, 'utf8')).toContain(`<meta name="build-version" content="v${commitTimeMs()}">`)
    } finally {
      removeDir(dist)
    }
  })
})
