/**
 * Planned-load window of the frontend deploy (board #2663).
 *
 * A deploy keeps the single prod core at 100 % for 10–12 minutes, and the
 * host `~/monitor.sh` mailed "System alert / recovered" for every one of
 * them. The deploy now declares the window in
 * `~/metravel-monitor/planned-load.d/frontend-deploy`; the monitor skips the
 * CPU-only reason while the window is valid.
 *
 * Contracts:
 *   1. `open` writes `<expires_epoch> <label>` atomically, `close` removes it;
 *   2. arguments that would reach the remote command line are validated;
 *   3. build-prod.sh opens the window before the first prod contact of a real
 *      deploy and closes it in on_exit.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from './cli-test-utils'
import { readCanonicalDeploy } from './remote-deploy-test-utils'

const scriptPath = path.resolve(process.cwd(), 'scripts/prod-planned-load.sh')

type Sandbox = { root: string; home: string; env: Record<string, string> }

// `ssh` runs the remote program locally with HOME pointed at the sandbox:
// options and the target are dropped, the rest (`bash -s -- …`) is executed
// with the same stdin.
function makeSandbox(): Sandbox {
  const root = makeTempDir('metravel-planned-load-')
  const stubBin = path.join(root, 'stub-bin')
  const home = path.join(root, 'home')
  fs.mkdirSync(stubBin, { recursive: true })
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(stubBin, 'ssh'),
    [
      '#!/bin/bash',
      'echo "$*" >> "$STUB_SSH_LOG"',
      'while [ "$1" = "-o" ]; do shift 2; done',
      'shift',
      'HOME="$STUB_HOME" exec "$@"',
      '',
    ].join('\n'),
  )
  fs.chmodSync(path.join(stubBin, 'ssh'), 0o755)
  return {
    root,
    home,
    env: {
      PATH: `${stubBin}:${process.env.PATH ?? ''}`,
      STUB_HOME: home,
      STUB_SSH_LOG: path.join(root, 'ssh.log'),
      DEPLOY_ENV_FILE: path.join(root, 'missing.env'),
      PROD_SSH_USER: 'deploy',
      PROD_SSH_HOST: 'prod.example',
      PROD_REMOTE_DIR: '/srv/metravel',
    },
  }
}

const windowFile = (sandbox: Sandbox) =>
  path.join(sandbox.home, 'metravel-monitor/planned-load.d/frontend-deploy')

describe('prod planned-load window', () => {
  let sandbox: Sandbox

  beforeEach(() => {
    sandbox = makeSandbox()
  })

  afterEach(() => {
    removeDir(sandbox.root)
  })

  it('opens a window with an expiry and label, then closes it', () => {
    const before = Math.floor(Date.now() / 1000)
    const opened = runCli(
      'bash',
      [scriptPath, 'open', 'frontend-deploy', '1200', 'frontend-deploy:65c088b956bf'],
      { env: sandbox.env },
    )
    expect(opened.status).toBe(0)
    const [expires, label] = fs.readFileSync(windowFile(sandbox), 'utf8').trim().split(' ')
    expect(Number(expires)).toBeGreaterThanOrEqual(before + 1200)
    expect(Number(expires)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1200)
    expect(label).toBe('frontend-deploy:65c088b956bf')
    expect(fs.readFileSync(sandbox.env.STUB_SSH_LOG, 'utf8')).toContain('deploy@prod.example')

    const closed = runCli('bash', [scriptPath, 'close', 'frontend-deploy'], { env: sandbox.env })
    expect(closed.status).toBe(0)
    expect(fs.existsSync(windowFile(sandbox))).toBe(false)
  })

  it.each([
    [['open', 'frontend-deploy', '30', 'x']],
    [['open', 'frontend-deploy', '3600', 'x']],
    [['open', 'Frontend Deploy', '1200', 'x']],
    [['open', 'frontend-deploy', '1200', 'label; rm -rf ~']],
    [['wipe', 'frontend-deploy']],
  ])('rejects %j before any ssh call', (args) => {
    const result = runCli('bash', [scriptPath, ...args], { env: sandbox.env })
    expect(result.status).toBe(2)
    expect(fs.existsSync(sandbox.env.STUB_SSH_LOG)).toBe(false)
  })

  it('fails without a deploy target and without ssh', () => {
    const result = runCli('bash', [scriptPath, 'open', 'frontend-deploy', '1200', 'x'], {
      env: { ...sandbox.env, PROD_SSH_HOST: '' },
    })
    expect(result.status).toBe(1)
    expect(fs.existsSync(sandbox.env.STUB_SSH_LOG)).toBe(false)
  })
})

describe('build-prod.sh planned-load wiring', () => {
  const source = readCanonicalDeploy()

  it('opens the window right after the source gate, before any prod contact', () => {
    const gate = source.indexOf('assert_deployable_source "$ENV" "$ALLOW_DIRTY" "$DEPLOY"\nopen_planned_load_window')
    expect(gate).toBeGreaterThan(0)
    for (const firstContact of ['start_prod_media_checks\n', 'stage "экспорт Metro"']) {
      expect(source.indexOf(firstContact, gate)).toBeGreaterThan(gate)
    }
  })

  it('opens only for a real prod deploy and never fails the deploy', () => {
    const body = source.slice(source.indexOf('open_planned_load_window() {'), source.indexOf('close_planned_load_window() {'))
    expect(body).toContain('[[ "$DEPLOY" == "1" && "$ENV" == "prod" ]] || return 0')
    expect(body).toMatch(/if bash scripts\/prod-planned-load\.sh open frontend-deploy/)
    expect(body).toContain('</dev/null')
  })

  it('closes the window in on_exit', () => {
    const onExit = source.slice(source.indexOf('on_exit() {'), source.indexOf('trap on_exit EXIT'))
    expect(onExit).toContain('close_planned_load_window || true')
  })
})
