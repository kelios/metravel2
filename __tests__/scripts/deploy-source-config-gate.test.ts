/**
 * Shared source+config gate must sit on every prod ship path (#1883).
 * Pattern matches #1427: read the three entry points as text so dropping the
 * call from any one file turns this suite red.
 */
import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, runNodeCli } from './cli-test-utils'
import { readCanonicalDeploy, readRecoveryDeploy } from './remote-deploy-test-utils'

const SOURCE_GATE = 'assert-deployable-source.js'
const SOURCE_GATE_SCRIPT = 'scripts/assert-deployable-source.js'
const CONFIG_GATE = 'scripts/verify-prod-config.js'
const MARKER = '.build-source.json'

const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'source config gate test',
  GIT_AUTHOR_EMAIL: 'source-config-gate@test.local',
  GIT_COMMITTER_NAME: 'source config gate test',
  GIT_COMMITTER_EMAIL: 'source-config-gate@test.local',
}

function readWebProd(): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'scripts/build-web-prod.js'), 'utf8')
}

describe('prod ship paths share the source and config gates (#1883)', () => {
  it('calls the shared source gate from every entry point', () => {
    expect(readCanonicalDeploy()).toContain(SOURCE_GATE)
    expect(readRecoveryDeploy()).toContain(SOURCE_GATE)
    expect(readWebProd()).toContain(SOURCE_GATE)
  })

  it('calls verify-prod-config.js from every entry point', () => {
    expect(readCanonicalDeploy()).toContain(CONFIG_GATE)
    expect(readRecoveryDeploy()).toContain(CONFIG_GATE)
    expect(readWebProd()).toContain(CONFIG_GATE)
  })

  it('writes and checks the artifact provenance marker', () => {
    expect(readCanonicalDeploy()).toContain(`--copy-marker "dist/$ENV/${MARKER}"`)
    expect(readRecoveryDeploy()).toContain(`--check-marker "dist/$ENV/${MARKER}"`)
    expect(readWebProd()).toContain(MARKER)
  })
})

describe('assert-deployable-source.js', () => {
  let root: string
  let work: string
  const script = path.resolve(process.cwd(), SOURCE_GATE_SCRIPT)

  beforeEach(() => {
    root = makeTempDir('assert-deployable-source-')
    work = path.join(root, 'work')
    const setup = runCli(
      'bash',
      [
        '-c',
        [
          'set -euo pipefail',
          'git init -q --bare origin',
          'git init -q work',
          'cd work',
          'git symbolic-ref HEAD refs/heads/main',
          'echo one > file.txt',
          'git add file.txt',
          'git commit -qm one',
          'git remote add origin ../origin',
          'git push -q origin main',
        ].join('\n'),
      ],
      { cwd: root, env: GIT_ENV },
    )
    expect(setup.status).toBe(0)
  })

  afterEach(() => {
    removeDir(root)
  })

  it('stops a dirty deploy tree', () => {
    fs.writeFileSync(path.join(work, 'stray.ts'), 'export {}\n')
    const result = runNodeCli([script, '--deploy', '1', '--allow-dirty', '0', '--cwd', work], GIT_ENV)
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('Рабочее дерево грязное')
    expect(result.stdout).toContain('stray.ts')
  })

  it('refuses a build-only dirty marker on fix-prod check', () => {
    const marker = path.join(work, 'dist', 'prod', MARKER)
    fs.mkdirSync(path.dirname(marker), { recursive: true })
    fs.writeFileSync(
      marker,
      JSON.stringify({ sha: 'abc', dirty: true, deploy: false, ok: true }),
    )
    const result = runNodeCli(
      [script, '--check-marker', marker, '--allow-dirty', '0', '--cwd', work],
      GIT_ENV,
    )
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('грязного дерева')
  })

  it('lets --allow-dirty through a dirty marker with a loud warning', () => {
    const marker = path.join(work, 'dist', 'prod', MARKER)
    fs.mkdirSync(path.dirname(marker), { recursive: true })
    fs.writeFileSync(
      marker,
      JSON.stringify({ sha: 'abc', dirty: true, deploy: false, ok: true }),
    )
    const result = runNodeCli(
      [script, '--check-marker', marker, '--allow-dirty', '1', '--cwd', work],
      GIT_ENV,
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('--allow-dirty')
  })
})
