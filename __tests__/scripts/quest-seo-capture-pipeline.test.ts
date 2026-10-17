/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const operation = path.resolve('scripts/quest-seo-operation.js')
const source = fs.readFileSync(path.resolve('build-prod.sh'), 'utf8')
const prelude = source.slice(source.indexOf("EXPORT_LOG=''"), source.indexOf('install_deps() {'))
const original = 'APP_ENV=dev\n'
const production = 'APP_ENV=production\n'

describe('build-owned background quest asset capture', () => {
  let root: string
  beforeEach(() => {
    root = fs.realpathSync(makeTempDir('quest-capture-pipeline-'))
    fs.mkdirSync(path.join(root, 'scripts'))
    fs.writeFileSync(path.join(root, '.env'), original)
    fs.writeFileSync(path.join(root, '.env.prod'), production)
    // Execute the shipped supervisor/worker code, replacing only the read-only
    // network capture command with a deterministic local process tree.
    fs.writeFileSync(path.join(root, 'scripts/quest-seo-operation.js'), `
const path = require('path');
const {superviseCapture} = require(${JSON.stringify(operation)});
const [, dist, state, nonce] = process.argv.slice(2);
superviseCapture(path.resolve(dist), path.resolve(state), nonce,
  process.env.FIXTURE_MODE === 'setup' ? undefined
    : process.env.FIXTURE_MODE === 'spawn-error' ? ['/not-a-capture-executable']
    : [process.execPath, path.resolve('capture.cjs'), path.resolve(state), nonce, process.env.FIXTURE_MODE])
  .then(code => {process.exitCode = code}).catch(error => {console.error(error);process.exitCode = 1});
`)
    fs.writeFileSync(path.join(root, 'capture.cjs'), `
const fs = require('fs'), {spawn} = require('child_process');
const [state, nonce, mode] = process.argv.slice(2);
const archive = state + '.overlay-' + nonce + '.tar.gz';
if (mode === 'descendant') {
  process.on('SIGTERM', () => fs.appendFileSync('signals', 'descendant TERM\\n'));
  fs.writeFileSync('descendant.pid', String(process.pid));
  fs.writeFileSync('ready', 'ready');
  setInterval(() => fs.appendFileSync('observed-env', fs.readFileSync('.env', 'utf8')), 20);
} else {
  fs.writeFileSync('capture.pid', String(process.pid));
  fs.writeFileSync(archive, 'closed capture', {mode:0o600});
  if (mode === 'slow') {
    process.on('SIGTERM', () => fs.appendFileSync('signals', 'capture TERM\\n'));
    spawn(process.execPath, [__filename, state, nonce, 'descendant'], {stdio:'ignore'});
    setInterval(() => {}, 1000);
  } else {
    if (mode === 'complete') fs.writeFileSync(state, JSON.stringify({schema_version:1,phase:'captured',
      capture:{nonce,state_file:state,archive}}));
    fs.writeFileSync('ready', 'ready');
    process.exit(mode === 'failure' ? 7 : 0);
  }
}
`)
    fs.writeFileSync(path.join(root, 'wait-ready.cjs'), `
const fs = require('fs'), until = Date.now() + 3000;
const timer = setInterval(() => {
  if(fs.existsSync('ready')) {clearInterval(timer);process.exit(0)}
  if(Date.now() > until) {clearInterval(timer);process.exit(2)}
}, 10);
`)
  })
  afterEach(() => removeDir(root))

  function run(mode: string, tail: string) {
    const script = [
      'set -Eeuo pipefail', prelude,
      'metravel_deploy_defaults() { :; }', 'ENV=prod', 'QUEST_SEO_STATE_PATH="$PWD/state.json"',
      'apply_env prod', 'start_quest_overlay_capture',
      `${JSON.stringify(process.execPath)} wait-ready.cjs`, tail,
    ].join('\n')
    return runCli('bash', ['-c', script], { cwd: root, env: {
      FIXTURE_MODE: mode, DEPLOY_ENV_FILE: path.join(root, 'deploy.env'),
      PROD_SSH_USER: 'fixture', PROD_SSH_HOST: 'fixture.invalid', PROD_REMOTE_DIR: '/fixture',
      PATH: `${root}${path.delimiter}${process.env.PATH}`,
    }, timeoutMs: 15000 })
  }

  function assertClean() {
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe(original)
    expect(fs.readdirSync(root).filter(name => name.startsWith('state.json'))).toEqual([])
  }

  function assertStopped(pidFile: string) {
    const pid = fs.readFileSync(path.join(root, pidFile), 'utf8')
    const status = runCli('ps', ['-p', pid, '-o', 'stat='], { timeoutMs: 1000 }).stdout.trim()
    expect(status === '' || status.startsWith('Z')).toBe(true)
  }

  it('waits for a completed capture and retains it for late apply', () => {
    const result = run('complete', 'close_quest_overlay_capture finish\necho READY-FOR-SEO')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('status=0')
    expect(result.stdout).toContain('READY-FOR-SEO')
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe(original)
    const state = JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8'))
    expect(fs.existsSync(state.capture.archive)).toBe(true)
    expect(fs.readdirSync(root).filter(name => name.includes('.control.'))).toEqual([])
  })

  it('propagates capture failure before SEO and removes the partial private archive', () => {
    const result = run('failure', 'close_quest_overlay_capture finish\necho MUST-NOT-RUN-SEO')
    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain('MUST-NOT-RUN-SEO')
    assertClean()
  })

  it('reports a capture-child spawn error and releases the IPC owner without leaving a process', () => {
    // No ready marker can exist when spawn fails; finish waits for that failure.
    fs.writeFileSync(path.join(root, 'ready'), 'ready')
    const result = run('spawn-error', 'close_quest_overlay_capture finish\necho MUST-NOT-RUN-SEO')
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('failed to start')
    expect(result.stdout).not.toContain('MUST-NOT-RUN-SEO')
    assertClean()
  })

  it('refuses to start a detached worker without its private IPC ownership channel', () => {
    const result = runCli(process.execPath, [operation, 'capture-worker', JSON.stringify([
      process.execPath, path.join(root, 'capture.cjs'), path.join(root, 'state.json'), 'a'.repeat(48), 'slow',
    ])], { cwd: root, timeoutMs: 3000 })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Private capture IPC required')
    expect(fs.existsSync(path.join(root, 'capture.pid'))).toBe(false)
  })

  it('cleans up an early completed capture after a later Metro failure without signalling a saved PID', () => {
    const result = run('complete', `${JSON.stringify(process.execPath)} -e 'setTimeout(()=>{},100)'\nexit 9`)
    expect(result.status).toBe(9)
    assertClean(); assertStopped('capture.pid')
  }, 15000)

  it.each(['Metro failure', 'build SIGTERM'])('cancels and reaps TERM-ignoring descendants on %s before restoring .env', (failure) => {
    const began = Date.now()
    const result = run('slow', failure === 'Metro failure' ? 'exit 9' : 'kill -TERM $$')
    expect(result.status).toBe(failure === 'Metro failure' ? 9 : 143)
    expect(Date.now() - began).toBeLessThan(10000)
    expect(fs.readFileSync(path.join(root, 'signals'), 'utf8')).toContain('descendant TERM')
    assertClean(); assertStopped('capture.pid'); assertStopped('descendant.pid')
    const observed = fs.readFileSync(path.join(root, 'observed-env'), 'utf8')
    expect(observed.length).toBeGreaterThan(0)
    expect(observed.replaceAll(production, '')).toBe('')
  }, 15000)

  it('owns transport shell setup and cancels a stalled SSH container lookup before restoring .env', () => {
    // The default shipped capture command must put the transport wrapper and
    // its container-resolution SSH children inside the same bounded group.
    fs.writeFileSync(path.join(root, 'ssh'), `#!/bin/bash\nexec ${JSON.stringify(process.execPath)} capture.cjs '' '' descendant\n`, { mode: 0o755 })
    const began = Date.now()
    const result = run('setup', 'exit 9')

    expect(result.status).toBe(9)
    expect(Date.now() - began).toBeLessThan(10000)
    expect(fs.readFileSync(path.join(root, 'signals'), 'utf8')).toContain('descendant TERM')
    assertClean(); assertStopped('descendant.pid')
    const observed = fs.readFileSync(path.join(root, 'observed-env'), 'utf8')
    expect(observed.length).toBeGreaterThan(0)
    expect(observed.replaceAll(production, '')).toBe('')
  }, 15000)

  it('keeps cancel writable when a signal interrupts the pending finish wait', () => {
    const began = Date.now()
    const result = run('slow', `${JSON.stringify(process.execPath)} -e 'setTimeout(()=>process.kill(Number(process.argv[1]),"SIGTERM"),100)' "$$" &\nclose_quest_overlay_capture finish`)

    expect(result.status).toBe(143)
    expect(Date.now() - began).toBeLessThan(10000)
    expect(result.stderr).not.toContain('Bad file descriptor')
    expect(fs.readFileSync(path.join(root, 'signals'), 'utf8')).toContain('descendant TERM')
    assertClean(); assertStopped('capture.pid'); assertStopped('descendant.pid')
    const observed = fs.readFileSync(path.join(root, 'observed-env'), 'utf8')
    expect(observed.length).toBeGreaterThan(0)
    expect(observed.replaceAll(production, '')).toBe('')
  }, 15000)

  it('cancels a pending finish when its Bash owner dies and closes the FIFO', async () => {
    const began = Date.now()
    const result = run('slow', "trap - EXIT\nprintf '%s' \"$QUEST_CAPTURE_PID\" > supervisor.pid\nprintf 'finish\\n' >&9\nkill -KILL $$")
    expect(result.status).not.toBe(0)
    // The dead shell cannot wait; retain fixture bytes until the independent
    // supervisor completes its bounded process-group cancellation.
    for (const name of ['supervisor.pid', 'capture.pid', 'descendant.pid']) {
      const pid = fs.readFileSync(path.join(root, name), 'utf8')
      while (true) {
        const status = runCli('ps', ['-p', pid, '-o', 'stat='], { timeoutMs: 1000 }).stdout.trim()
        if (!status || status.startsWith('Z') || Date.now() - began >= 8000) break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    expect(Date.now() - began).toBeLessThan(10000)
    expect(fs.readFileSync(path.join(root, 'signals'), 'utf8')).toContain('descendant TERM')
    assertStopped('supervisor.pid'); assertStopped('capture.pid'); assertStopped('descendant.pid')
    expect(fs.readdirSync(root).filter(name => name.startsWith('state.json') && !name.includes('.control.'))).toEqual([])
  }, 15000)

  it('keeps one v1 live guard after the final HTML writer and apply, plus all independent package gates', () => {
    const capture = source.indexOf('  start_quest_overlay_capture\n')
    const metro = source.indexOf('build_env "$ENV"\n', capture)
    const wait = source.indexOf('  close_quest_overlay_capture finish\n', metro)
    const seo = source.indexOf('node scripts/generate-seo-pages.js', wait)
    const writer = source.indexOf('node scripts/add-cache-bust-meta.js', seo)
    const apply = source.indexOf('bash scripts/quest-seo-operation.sh apply', writer)
    const liveGuard = source.indexOf('node scripts/verify-static-quest-seo.js --dist "dist/$ENV" --api https://metravel.by --quest-seo-candidate-pending', apply)
    const finalize = source.indexOf('node scripts/finalize-quest-seo-package.js', liveGuard)
    const sealed = source.indexOf('node scripts/verify-static-quest-seo.js --dist "dist/$ENV" --quest-seo-package-only', finalize)
    const prepare = source.indexOf('node scripts/quest-seo-operation.js prepare', sealed)
    expect([capture, metro, wait, seo, writer, apply, liveGuard, finalize, sealed, prepare].every(index => index >= 0)).toBe(true)
    expect(source.match(/--quest-seo-candidate-pending/g)).toHaveLength(1)
    expect(source).toContain('if [[ "$QUEST_SEO_MODE" == "legacy" ]]; then\n  echo "Проверка: quest-страницы')
    expect(source).toContain('node scripts/build-web-safe.js -p web -c')
    expect(source).toContain('node scripts/quest-seo-operation.js capture "dist/$ENV"')
  })
})
