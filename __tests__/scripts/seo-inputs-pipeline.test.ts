/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import vm from 'vm'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

const supervisor = path.resolve('scripts/seo-inputs-supervisor.js')
const source = fs.readFileSync('build-prod.sh', 'utf8')
const prelude = source.slice(source.indexOf("EXPORT_LOG=''"), source.indexOf('install_deps() {'))

describe('owned SEO input producer lifecycle', () => {
  let root: string
  beforeEach(() => {
    root = fs.realpathSync(makeTempDir('seo-input-pipeline-'))
    fs.mkdirSync(path.join(root, 'scripts'))
    fs.writeFileSync(path.join(root, '.env'), 'ORIGINAL\n')
    fs.writeFileSync(path.join(root, '.env.prod'), 'PRODUCTION\n')
    fs.writeFileSync(path.join(root, 'scripts/seo-inputs-supervisor.js'), `
const {supervise}=require(${JSON.stringify(supervisor)});
const command=JSON.parse(process.argv[3]);
const output=command[command.indexOf('--collect-inputs')+1];
const mode=process.env.FIXTURE_MODE;
supervise(mode==='spawn-error'?['/not-an-executable']:[process.execPath,'producer.cjs',output,mode])
 .then(code=>process.exitCode=code).catch(error=>{console.error(error);process.exitCode=1});`)
    fs.writeFileSync(path.join(root, 'producer.cjs'), `
const fs=require('fs'),{spawn}=require('child_process');
const [output,mode]=process.argv.slice(2);
if(mode==='descendant'){
 process.on('SIGTERM',()=>fs.appendFileSync('signals','descendant TERM\\n'));
 fs.writeFileSync('descendant.pid',String(process.pid));fs.writeFileSync('ready','ready');
 setInterval(()=>fs.appendFileSync('observed-env',fs.readFileSync('.env','utf8')),20);
}else{
 fs.writeFileSync('producer.pid',String(process.pid));fs.writeFileSync(output,'closed input');
 if(mode==='slow'){
  process.on('SIGTERM',()=>fs.appendFileSync('signals','producer TERM\\n'));
  spawn(process.execPath,[__filename,output,'descendant'],{stdio:'ignore'});setInterval(()=>{},1000);
 }else {fs.writeFileSync('ready','ready');process.exit(mode==='failure'?7:0)}
}`)
    fs.writeFileSync(path.join(root, 'wait-ready.cjs'), `
const fs=require('fs'),until=Date.now()+3000;
const timer=setInterval(()=>{if(fs.existsSync('ready')){clearInterval(timer);process.exit(0)}if(Date.now()>until)process.exit(2)},10);`)
  })
  afterEach(() => removeDir(root))
  function run(mode: string, tail: string) {
    if (mode === 'spawn-error') fs.writeFileSync(path.join(root, 'ready'), 'ready')
    return runCli('bash', ['-c', [
      'set -Eeuo pipefail', prelude, 'ENV=prod', 'BUILD_SOURCE_SHA=' + 'a'.repeat(40),
      'QUEST_SEO_STATE_PATH="$PWD/state.json"', 'QUEST_SEO_ARGS=(--quest-seo-candidate "$PWD/candidate.json")',
      'apply_env prod', 'start_seo_input_collection', `${JSON.stringify(process.execPath)} wait-ready.cjs`, tail,
    ].join('\n')], { cwd: root, env: { FIXTURE_MODE: mode }, timeoutMs: 15000 })
  }
  function clean() {
    expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toBe('ORIGINAL\n')
    expect(fs.readdirSync(root).some(name => name.includes('.seo-inputs.'))).toBe(false)
  }
  function stopped(file: string) {
    const pid = fs.readFileSync(path.join(root, file), 'utf8')
    const status = runCli('ps', ['-p', pid, '-o', 'stat='], { timeoutMs: 1000 }).stdout.trim()
    expect(status === '' || status.startsWith('Z')).toBe(true)
  }
  it('refuses an already orphaned supervisor before spawning any work or timer', async () => {
    const spawn = jest.fn(), interval = jest.fn(), module = { exports: {} as any }
    vm.runInNewContext(fs.readFileSync('scripts/lib/ownedProcessSupervisor.js', 'utf8'), {
      module, require: () => ({ spawn }), process: { ppid: 1 }, setInterval: interval,
    })
    await expect(module.exports.supervise(['unused'], 'fixture')).resolves.toBe(1)
    expect(spawn).not.toHaveBeenCalled()
    expect(interval).not.toHaveBeenCalled()
  })
  it('reaps completed inputs before offline render and removes them on build exit', () => {
    const result = run('complete', 'close_seo_input_collection finish\ntest -f "$SEO_INPUT_CONTROL/inputs.json"\necho OFFLINE-READY')
    expect(result.status).toBe(0); expect(result.stdout).toContain('OFFLINE-READY'); clean(); stopped('producer.pid')
  })
  it.each(['failure', 'spawn-error'])('propagates %s before offline rendering', mode => {
    const result = run(mode, 'close_seo_input_collection finish\necho MUST-NOT-RENDER')
    expect(result.status).toBe(1); expect(result.stdout).not.toContain('MUST-NOT-RENDER'); clean()
  })
  it('cleans an early completed producer when Metro subsequently fails', () => {
    const result = run('complete', 'exit 9')
    expect(result.status).toBe(9); clean(); stopped('producer.pid')
  }, 15000)
  it.each(['Metro failure', 'signal during finish'])('reaps the full TERM-ignoring group before env restoration on %s', mode => {
    const tail = mode === 'Metro failure' ? 'exit 9'
      : `${JSON.stringify(process.execPath)} -e 'setTimeout(()=>process.kill(Number(process.argv[1]),"SIGTERM"),100)' "$$" &\nclose_seo_input_collection finish`
    const result = run('slow', tail)
    expect(result.status).toBe(mode === 'Metro failure' ? 9 : 143)
    expect(result.stderr).not.toContain('Bad file descriptor')
    expect(fs.readFileSync(path.join(root, 'signals'), 'utf8')).toContain('descendant TERM')
    clean(); stopped('producer.pid'); stopped('descendant.pid')
    expect(fs.readFileSync(path.join(root, 'observed-env'), 'utf8').replaceAll('PRODUCTION\n', '')).toBe('')
  }, 15000)
  it('cancels a pending finish when its Bash owner dies and closes the FIFO', async () => {
    const began = Date.now()
    const result = run('slow', "trap - EXIT\nprintf '%s' \"$SEO_INPUT_PID\" > supervisor.pid\nprintf 'finish\\n' >&8\nkill -KILL $$")
    expect(result.status).not.toBe(0)
    // SIGKILL returns the shell result immediately. The independent supervisor
    // must still finish its bounded TERM/KILL/reap protocol before assertions.
    for (const name of ['supervisor.pid', 'producer.pid', 'descendant.pid']) {
      const pid = fs.readFileSync(path.join(root, name), 'utf8')
      while (true) {
        const status = runCli('ps', ['-p', pid, '-o', 'stat='], { timeoutMs: 1000 }).stdout.trim()
        if (!status || status.startsWith('Z') || Date.now() - began >= 8000) break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    expect(Date.now() - began).toBeLessThan(10000)
    expect(fs.readFileSync(path.join(root, 'signals'), 'utf8')).toContain('descendant TERM')
    stopped('supervisor.pid'); stopped('producer.pid'); stopped('descendant.pid')
  }, 15000)
  it('serializes network producers while preserving cold Metro, audit coverage and late independent gates', () => {
    const collect = source.indexOf('  start_seo_input_collection\n')
    const metro = source.indexOf('build_env "$ENV"\n', collect)
    const reaped = source.indexOf('  close_seo_input_collection finish\n', metro)
    const audits = source.indexOf('then start_prod_media_checks; fi', reaped)
    const offline = source.indexOf('node scripts/generate-seo-pages.js --dist', audits)
    const auditsDone = source.indexOf('  finish_prod_media_checks\n', offline)
    const liveTravel = source.indexOf('node scripts/verify-static-travel-seo.js', auditsDone)
    const writer = source.indexOf('node scripts/add-cache-bust-meta.js', liveTravel)
    const liveQuest = source.indexOf('--quest-seo-candidate-pending', writer)
    const r2 = source.indexOf('node scripts/finalize-quest-seo-package.js', liveQuest)
    const sealed = source.indexOf('--quest-seo-package-only', r2)
    const indexed = source.indexOf('node scripts/quest-seo-operation.js prepare', sealed)
    expect([collect, metro, reaped, audits, offline, auditsDone, liveTravel, writer, liveQuest, r2, sealed, indexed].every(index => index >= 0)).toBe(true)
    expect(source).toContain('node scripts/build-web-safe.js -p web -c')
    expect(source.indexOf('close_seo_input_collection cancel')).toBeLessThan(source.indexOf('  restore_env_file\n'))
    const audit = fs.readFileSync('scripts/audit-article-body-media.js', 'utf8')
    expect(audit).toContain('/api/travels/?page=${page}&perPage=${pageSize}')
    const media = fs.readFileSync('scripts/post-deploy-media-check.js', 'utf8')
    expect(media).toContain('const UPLOADS_ANCHOR_TRAVEL_IDS = [116, 171, 220, 290]')
    expect(media).toContain('for (const id of UPLOADS_ANCHOR_TRAVEL_IDS)')
  })
  it.each([
    ['supervise', '--typo'], ['unknown', '[]'], ['supervise'],
    ['supervise', '[]', 'extra'], ['supervise', '{'], ['supervise', '[""]'],
  ])('rejects invalid shipped CLI input before creating a producer: %j', (...args) => {
    const result = runCli(process.execPath, [supervisor, ...args], { cwd: root, timeoutMs: 3000 })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Usage:')
    expect(fs.existsSync(path.join(root, 'producer.pid'))).toBe(false)
  })
  it('runs the shipped CLI through explicit finish and preserves the producer exit result', () => {
    const command = [process.execPath, '-e', 'process.exit(0)']
    const result = runCli('bash', ['-c', [
      'set -Eeuo pipefail', 'mkfifo control', 'exec 8<>control',
      `${JSON.stringify(process.execPath)} ${JSON.stringify(supervisor)} supervise '${JSON.stringify(command)}' <&8 &`,
      'owner=$!', "printf 'finish\\n' >&8", 'wait "$owner"', 'exec 8>&-',
    ].join('\n')], { cwd: root, timeoutMs: 3000 })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('status=0')
  })
})
