import path from 'node:path'
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils'

const lockModule = require('@/scripts/quality-gate-lock')

describe('quality-gate-lock', () => {
  const originalOwned = process.env.MT_QUALITY_GATE_LOCK_OWNED

  afterEach(() => {
    lockModule.releaseQualityGateLock()
    if (originalOwned === undefined) delete process.env.MT_QUALITY_GATE_LOCK_OWNED
    else process.env.MT_QUALITY_GATE_LOCK_OWNED = originalOwned
  })

  it('parses process rows and ignores the current command ancestry', () => {
    const rows = lockModule.parseProcessTable(`
      10 1 npm run test:run
      11 10 node /repo/scripts/run-with-quality-gate-lock.js test:run -- jest
      12 11 /repo/node_modules/.bin/jest --runInBand
      20 1 /repo/node_modules/playwright/cli.js test
    `)

    const conflicts = lockModule.findConflictingQualityProcesses({
      rows,
      root: '/repo',
      currentPid: 11,
      getCwd: () => '/repo',
    })

    expect(conflicts.map((row: { pid: number }) => row.pid)).toEqual([12, 20])
  })

  it('blocks a second process and releases the atomic lock for the next run', () => {
    const tempDir = makeTempDir('quality-gate-lock-')
    const lockPath = path.join(tempDir, 'quality-gate.lock')
    const modulePath = require.resolve('@/scripts/quality-gate-lock')
    delete process.env.MT_QUALITY_GATE_LOCK_OWNED

    lockModule.acquireQualityGateLock({ name: 'owner', lockPath, detectProcesses: false })

    const attempt = (name: string) =>
      runNodeCli(
        [
          '-e',
          `const lock=require(${JSON.stringify(modulePath)});` +
            `try{lock.acquireQualityGateLock({name:${JSON.stringify(name)},lockPath:${JSON.stringify(lockPath)},detectProcesses:false});lock.releaseQualityGateLock();}` +
            `catch(error){console.error(error.code+':'+error.message);process.exit(73)}`,
        ],
        { MT_QUALITY_GATE_LOCK_OWNED: '' }
      )

    const blocked = attempt('blocked')
    expect(blocked.status).toBe(73)
    expect(blocked.stderr).toContain('QUALITY_GATE_BUSY')
    expect(blocked.stderr).toContain(`pid=${process.pid}`)

    lockModule.releaseQualityGateLock()
    const allowed = attempt('allowed')
    expect(allowed.status).toBe(0)

    removeDir(tempDir)
  })

  it('returns a neutral skipped result instead of waiting or rerunning through the wrapper', () => {
    const wrapperPath = require.resolve('@/scripts/run-with-quality-gate-lock')
    const result = runNodeCli(
      [wrapperPath, 'concurrent-test', '--', process.execPath, '-e', 'process.exit(41)'],
      { MT_QUALITY_GATE_LOCK_OWNED: '' }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('quality-gate-lock: SKIPPED')
    expect(result.stdout).toContain('do not wait, poll, or rerun this command')
  })

  it('returns the same skipped result for direct Jest setup contention', () => {
    const setupPath = require.resolve('@/scripts/jest-quality-gate-setup')
    const result = runNodeCli(
      [
        '-e',
        `Promise.resolve(require(${JSON.stringify(setupPath)})()).then(()=>process.exit(41))`,
      ],
      { MT_QUALITY_GATE_LOCK_OWNED: '' }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('quality-gate-lock: SKIPPED')
    expect(result.stdout).toContain('active gate owner is responsible for failures')
  })
})
