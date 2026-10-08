/** @jest-environment node */
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { makeTempDir, removeDir, runNodeCli, runCli, startStubServer } from './cli-test-utils'

const { createTokenSession, formatTokenError, qaTokenSources, readTokenCandidate, targetPolicy, normalizeLoginCredentials } = require('@/scripts/lib/metravel-token')
const { atomicPublish, withRefreshLock, processIdentity, readRegular } = require('@/scripts/lib/metravel-token-cache')
const ROOT = path.resolve(__dirname, '../..')
const SENTINEL = 'SENTINEL_DO_NOT_PRINT'
let homeDir: string
beforeEach(() => { homeDir = makeTempDir('metravel-token-fixture-') })
afterEach(() => { removeDir(homeDir) })

function response(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => typeof body === 'string' ? body : JSON.stringify(body) }
}
function session(fetchImpl: any, options: any = {}) {
  const origin = 'https://token.test'
  return createTokenSession({ origin, profile: 'qa104', sources: [{ kind: 'value', value: 'expired' }],
    refreshPolicy: 'primary-qa', homeDir,
    fixture: { origin, fetchImpl, credentials: { email: 'fixture@example.invalid', password: SENTINEL } }, ...options })
}
const me = (url: string) => url.endsWith('/api/user/me/')
const login = (url: string) => url.endsWith('/api/user/login/')

describe('identity and trusted authentication boundary', () => {
  it.each([['owner', 1], ['editor', 120], ['editor', 121], ['staff-readonly', 104]])('%s never substitutes QA104 for the selected identity', async (profile, id) => {
    const calls: string[] = []
    const auth = session(async (url: string) => { calls.push(url); return response(200, { id: 104 }) },
      { profile, expectedUserId: id, sources: [{ kind: 'value', value: SENTINEL }], refreshPolicy: 'never' })
    if (id !== 104) await expect(auth.request('/api/travels/', { method: 'POST', json: { title: 'unchanged' } })).rejects.toThrow('verify/identity')
    else await auth.request('/api/travels/', { method: 'GET' })
    expect(calls.filter(login)).toHaveLength(0)
    expect(calls.filter((url) => !me(url))).toHaveLength(id === 104 ? 1 : 0)
    expect(fs.readdirSync(homeDir)).toEqual([])
  })
  it.each([1, 120, 121])('keeps an explicitly selected correct identity %i', async (id) => {
    const calls: string[] = []
    const auth = session(async (url: string) => { calls.push(url); return response(200, me(url) ? { id } : { ok: true }) },
      { profile: id === 1 ? 'owner' : 'editor', expectedUserId: id, sources: [{ kind: 'value', value: SENTINEL }], refreshPolicy: 'never' })
    await auth.request('/api/travels/', { method: 'POST', json: { author: id } })
    expect(calls.map((url) => new URL(url).pathname)).toEqual(['/api/user/me/', '/api/travels/'])
    expect(fs.readdirSync(homeDir)).toEqual([])
  })
  it.each([{}, { id: '104' }, { id: null }, { user: { id: 104 } }])('HTTP200 without strict current-user identity cannot authorize a write: %j', async (body) => {
    const fetchImpl = jest.fn(async () => response(200, body))
    await expect(session(fetchImpl).request('/api/quests/1/', { method: 'PATCH', json: { unchanged: true } })).rejects.toThrow('verify/identity')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it.each([403, 429, 500, 502, 503])('HTTP%i is not a credential refresh signal', async (status) => {
    const fetchImpl = jest.fn(async () => response(status, SENTINEL))
    let error: any
    try { await session(fetchImpl).request('/api/quests/1/', { method: 'PATCH' }) } catch (caught) { error = caught }
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(formatTokenError(error)).toContain(`HTTP ${status}`)
    expect(formatTokenError(error)).not.toContain(SENTINEL)
  })
  it.each(['https://evil.test/api/x/', 'https://token.test:444/api/x/', 'https://user:password@token.test/api/x/', '//evil.test/x', '/api/x/\n'])('rejects destination %s before discovery or login', async (endpoint) => {
    const fetchImpl = jest.fn()
    await expect(session(fetchImpl).request(endpoint)).rejects.toThrow('request/origin')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('does not follow a credential-bearing redirect or expose its reflected body', async () => {
    const fetchImpl = jest.fn(async (url: string) => me(url) ? response(401, SENTINEL) : response(307, SENTINEL))
    let error: any
    try { await session(fetchImpl).request('/api/quests/1/') } catch (caught) { error = caught }
    expect(formatTokenError(error)).toBe('metravel-auth: request/redirect')
    expect(fetchImpl.mock.calls).toHaveLength(2)
    expect(fetchImpl.mock.calls.every((call: any) => call[0].startsWith('https://token.test/'))).toBe(true)
    expect(fs.readdirSync(homeDir)).toEqual(['.metravel_token.qa104.lock.claims'])
    expect(fs.readdirSync(path.join(homeDir, '.metravel_token.qa104.lock.claims'))).toEqual([])
  })
  it('does not read ambient credentials or fallback caches in fixture mode', async () => {
    const fetchImpl = jest.fn(async () => response(401, {}))
    const auth = session(fetchImpl, { fixture: { origin: 'https://token.test', fetchImpl } })
    await expect(auth.ensureToken()).rejects.toThrow('login/credentials')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(() => session(fetchImpl, { sources: [{ kind: 'env', name: 'METRAVEL_TOKEN' }] })).toThrow('configure/configuration')
  })
})

describe('bounded replay, singleflight and cache ownership', () => {
  it('two simultaneous requests with the same rejected token login once and replay identical JSON', async () => {
    let logins = 0
    const writes: { auth: string; body: string }[] = []
    const fetchImpl = async (url: string, init: any) => {
      if (me(url)) return response(init.headers.Authorization === 'Token renewed' ? 200 : 401, { id: 104 })
      if (login(url)) { logins++; await new Promise((resolve) => setTimeout(resolve, 25)); return response(200, { token: 'renewed' }) }
      writes.push({ auth: init.headers.Authorization, body: Buffer.from(init.body).toString() })
      return response(200, { ok: true })
    }
    const [a, b] = [session(fetchImpl), session(fetchImpl)]
    await Promise.all([a.request('/api/quests/1/', { method: 'PATCH', json: { stable: ['same'] } }), b.request('/api/quests/2/', { method: 'PATCH', json: { stable: ['same'] } })])
    expect(logins).toBe(1)
    expect(writes).toEqual([{ auth: 'Token renewed', body: '{"stable":["same"]}' }, { auth: 'Token renewed', body: '{"stable":["same"]}' }])
    const stored = path.join(homeDir, '.metravel_token.qa104')
    expect(fs.readFileSync(stored, 'utf8')).toBe('renewed\n')
    expect(fs.statSync(stored).mode & 0o777).toBe(0o600)
    expect(fs.readdirSync(homeDir).sort()).toEqual(['.metravel_token.profiles.json', '.metravel_token.qa104', '.metravel_token.qa104.lock.claims'])
  })
  it('a trusted operation401 retries once with frozen body, but a second401 is terminal', async () => {
    let logins = 0
    const attempts: Buffer[] = []
    const fetchImpl = async (url: string, init: any) => {
      if (me(url)) return response(200, { id: 104 })
      if (login(url)) { logins++; return response(200, { token: 'renewed' }) }
      attempts.push(Buffer.from(init.body)); return response(401, SENTINEL)
    }
    const auth = session(fetchImpl, { sources: [{ kind: 'value', value: 'initial-valid' }] })
    await expect(auth.request('/api/quests/1/', { method: 'PUT', body: Buffer.from('frozen-upload') })).rejects.toThrow('HTTP 401')
    expect(logins).toBe(1)
    expect(attempts).toHaveLength(2)
    expect(attempts[0].equals(attempts[1])).toBe(true)
  })
  it('changing bodyFactory input after401 refuses a changed operation before replay', async () => {
    let operations = 0
    const fetchImpl = async (url: string) => {
      if (me(url)) return response(200, { id: 104 })
      if (login(url)) return response(200, { token: 'renewed' })
      operations++; return response(401, {})
    }
    const bodyFactory = jest.fn().mockResolvedValueOnce(Buffer.from('original')).mockResolvedValueOnce(Buffer.from('changed'))
    await expect(session(fetchImpl, { sources: [{ kind: 'value', value: 'valid' }] }).request('/api/files/', { method: 'POST', bodyFactory })).rejects.toThrow('request/body')
    expect(operations).toBe(1)
    expect(bodyFactory).toHaveBeenCalledTimes(2)
  })
  it('refresh leaves unbound legacy, author, editor and MCP cache bytes unchanged', async () => {
    const files = ['.metravel_token', '.metravel_editor_token', 'mcp_token.json']
    for (const file of files) fs.writeFileSync(path.join(homeDir, file), file === 'mcp_token.json' ? '{"token":"owner"}' : 'unbound-expired')
    const fetchImpl = async (url: string, init: any) => me(url) ? response(init.headers.Authorization === 'Token renewed' ? 200 : 401, { id: 104 }) : response(200, { token: 'renewed' })
    await session(fetchImpl, { sources: [{ kind: 'file', path: path.join(homeDir, '.metravel_token'), format: 'plain' }] }).ensureToken()
    for (const file of files) expect(fs.readFileSync(path.join(homeDir, file), 'utf8')).toBe(file === 'mcp_token.json' ? '{"token":"owner"}' : 'unbound-expired')
  })
  it('a conflicting dedicated valid owner cache stops refresh before login', async () => {
    fs.writeFileSync(path.join(homeDir, '.metravel_token.qa104'), 'owner')
    const fetchImpl = jest.fn(async (_url: string, init: any) => init.headers.Authorization === 'Token owner' ? response(200, { id: 1 }) : response(401, {}))
    await expect(session(fetchImpl).ensureToken()).rejects.toThrow('verify/identity')
    expect(fetchImpl.mock.calls.filter((call: any) => login(call[0]))).toHaveLength(0)
    expect(fs.readFileSync(path.join(homeDir, '.metravel_token.qa104'), 'utf8')).toBe('owner')
  })
  it('expired unbound dedicated cache is not overwritten and causes no login', async () => {
    fs.writeFileSync(path.join(homeDir, '.metravel_token.qa104'), 'unknown-expired')
    const fetchImpl = jest.fn(async () => response(401, {}))
    await expect(session(fetchImpl).ensureToken()).rejects.toThrow('persist/cache')
    expect(fetchImpl.mock.calls.filter((call: any) => login(call[0]))).toHaveLength(0)
    expect(fs.readFileSync(path.join(homeDir, '.metravel_token.qa104'), 'utf8')).toBe('unknown-expired')
  })
  it('rejects symlink destinations before login and retains the referenced bytes', async () => {
    const target = path.join(homeDir, 'owner')
    fs.writeFileSync(target, SENTINEL)
    fs.symlinkSync(target, path.join(homeDir, '.metravel_token.qa104'))
    const fetchImpl = jest.fn(async () => response(401, {}))
    await expect(session(fetchImpl).ensureToken()).rejects.toThrow('read/cache')
    expect(fetchImpl.mock.calls.filter((call: any) => login(call[0]))).toHaveLength(0)
    expect(fs.readFileSync(target, 'utf8')).toBe(SENTINEL)
  })
  it('a live lock is never stolen by age; timeout is masked and leaves the lock intact', async () => {
    const file = path.join(homeDir, '.metravel_token.qa104.lock')
    const bytes = JSON.stringify({ pid: process.pid, nonce: 'a'.repeat(48) })
    fs.writeFileSync(file, bytes)
    fs.utimesSync(file, new Date(0), new Date(0))
    const fetchImpl = jest.fn(async () => response(401, {}))
    await expect(session(fetchImpl, { refreshTimeoutMs: 35 }).ensureToken()).rejects.toThrow('refresh/lock')
    expect(fs.readFileSync(file, 'utf8')).toBe(bytes)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('failed preparation preserves every prior destination byte', () => {
    const file = path.join(homeDir, '.metravel_token.qa104')
    fs.writeFileSync(file, 'old\n')
    // All destinations are validated before preparation; an invalid parent
    // cannot cause a partially published success or temp residue.
    expect(() => atomicPublish([{ file, bytes: Buffer.from('new') }, { file: path.join(homeDir, 'missing-parent', 'cache'), bytes: Buffer.from('other') }])).toThrow()
    expect(fs.readFileSync(file, 'utf8')).toBe('old\n')
    expect(fs.readdirSync(homeDir).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })
})

it('explicit/env/plain/JSON precedence is centralized without exposing candidates', () => {
  const file = path.join(homeDir, 'legacy.json')
  fs.writeFileSync(file, '{"token":"json-token","other":"unchanged"}')
  fs.writeFileSync(path.join(homeDir, '.metravel_token'), 'home-token\n')
  const sources = qaTokenSources({ explicit: 'flag', env: { METRAVEL_TOKEN: 'env-token' }, homeDir, extraSources: [{ kind: 'file', path: file, format: 'json' }] })
  expect(readTokenCandidate(sources)).toBe('flag')
  expect(readTokenCandidate(sources.slice(1))).toBe('env-token')
  expect(readTokenCandidate(sources.slice(2))).toBe('json-token')
})

it('status CLI rejects credential-bearing origin/unknown arguments with no sentinel on either stream', () => {
  for (const args of [[`--api-url=https://user:${SENTINEL}@evil.invalid`], [`--token=${SENTINEL}`], [`--env-file=${SENTINEL}`]]) {
    const result = runNodeCli(['--', 'scripts/get-quest-token.js', ...args], {}, { cwd: ROOT })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).not.toContain(SENTINEL)
    expect(result.stderr).not.toContain('at ')
  }
})

it('finale uploader leaves endpoint origin selection to the supplied identity session', async () => {
  const file = path.join(homeDir, 'replacement.mp4')
  fs.writeFileSync(file, 'fixture-video')
  const request = jest.fn(async () => ({ ok: true, json: async () => ({ video_url: 'fixture' }) }))
  const { patchFinale } = require('../../scripts/upload-quest-finales')
  await expect(patchFinale(7, { video: file }, { request })).resolves.toEqual({ video_url: 'fixture' })
  expect(request).toHaveBeenCalledWith('/api/quest-finales/7/', expect.objectContaining({ method: 'PATCH', body: expect.any(FormData) }))
})

it('finale uploader declares the PNG poster type in the immutable multipart payload', async () => {
  const file = path.join(homeDir, 'replacement.png')
  fs.writeFileSync(file, 'fixture-png')
  const request = jest.fn(async (..._args: any[]) => ({ ok: true, json: async () => ({ poster_url: 'fixture' }) }))
  const { patchFinale } = require('../../scripts/upload-quest-finales')
  await patchFinale(5, { poster: file }, { request })
  const poster = request.mock.calls[0][1].body.get('poster')
  expect(poster.type).toBe('image/png')
  expect(poster.name).toBe('replacement.png')
})

it('tool factory rejects credential-bearing origins before a caller can log them, without reading token sources', () => {
  const { createToolSession } = require('../../scripts/lib/metravel-tool-session')
  const env = {}
  const sourceRead = jest.fn(() => { throw new Error('source must remain lazy') })
  Object.defineProperty(env, 'METRAVEL_TOKEN', { get: sourceRead })
  const options = { origin: `https://user:${SENTINEL}@metravel.by/api`, env }
  expect(() => createToolSession(options)).toThrow('configure/origin')
  expect(sourceRead).not.toHaveBeenCalled()
})

it('two child processes with distinct expired aliases produce exactly one login and one owned cache', async () => {
  const state = path.join(homeDir, 'state.json')
  const server = await startStubServer(`
    const http = require('node:http'), fs = require('node:fs');
    let logins = 0, writes = 0;
    http.createServer((req,res) => {
      let body=''; req.on('data', c => body += c); req.on('end', () => {
        let status=200, out={id:104};
        if(req.url === '/api/user/login/') { logins++; out={token:'renewed'}; }
        else if(req.headers.authorization !== 'Token renewed') { status=401; out={detail:'${SENTINEL}'}; }
        else if(req.url === '/api/quests/1/') { writes++; out={ok:true}; }
        fs.writeFileSync(${JSON.stringify(state)}, JSON.stringify({logins,writes}));
        setTimeout(() => {res.writeHead(status, {'Content-Type':'application/json'});res.end(JSON.stringify(out));}, req.url === '/api/user/login/' ? 40 : 0);
      });
    }).listen(0,'127.0.0.1',function(){ console.log('PORT='+this.address().port); });
  `, homeDir)
  const runner = path.join(homeDir, 'child.cjs')
  fs.writeFileSync(runner, `
    const {createTokenSession,formatTokenError}=require(process.argv[2]);
    let raw=''; process.stdin.on('data', c=>raw+=c);
    process.stdin.on('end',async()=>{try{
      const cfg=JSON.parse(raw), auth=createTokenSession(cfg);
      await auth.request('/api/quests/1/',{method:'PUT',json:{unchanged:true}});
      process.stdout.write('ready');
    }catch(e){process.stderr.write(formatTokenError(e));process.exitCode=1;}});
  `)
  const children: any[] = []
  try {
    const run = (alias: string) => new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
      const file = path.join(homeDir, alias)
      fs.writeFileSync(file, 'expired-shared\n')
      const child = spawn(process.execPath, [runner, path.join(ROOT, 'scripts/lib/metravel-token.js')], { env: { ...process.env, NODE_ENV: 'test' }, stdio: ['pipe', 'pipe', 'pipe'] })
      children.push(child)
      let stdout = '', stderr = ''
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      const timer = setTimeout(() => { child.kill(); reject(new Error('fixture child timed out')) }, 7000)
      child.on('error', (error) => { clearTimeout(timer); reject(error) })
      child.on('close', (code: number) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
      child.stdin.end(JSON.stringify({ origin: server.origin, profile: 'qa104', homeDir, sources: [{ kind: 'file', path: file, format: 'plain' }], refreshPolicy: 'primary-qa', fixture: { origin: server.origin, credentials: { email: 'fixture@example.invalid', password: SENTINEL } } }))
    })
    const results = await Promise.all([run('alias-a'), run('alias-b')])
    expect(results).toEqual([{ code: 0, stdout: 'ready', stderr: '' }, { code: 0, stdout: 'ready', stderr: '' }])
    expect(JSON.parse(fs.readFileSync(state, 'utf8'))).toEqual({ logins: 1, writes: 2 })
    for (const alias of ['alias-a', 'alias-b']) expect(fs.readFileSync(path.join(homeDir, alias), 'utf8')).toBe('expired-shared\n')
    expect(fs.readFileSync(path.join(homeDir, '.metravel_token.qa104'), 'utf8')).toBe('renewed\n')
    expect(fs.readdirSync(homeDir).filter((name) => /\.(lock|tmp|restore)$/.test(name))).toEqual([])
  } finally { children.forEach((child) => { if (child.exitCode == null) child.kill() }); server.stop() }
}, 12000)


it('native multipart retry sends exactly equivalent bytes and keeps reflected auth failures off output', () => {
  const runner = path.join(homeDir, 'multipart.cjs')
  fs.writeFileSync(runner, `
    const {createTokenSession,formatTokenError}=require(process.argv[2]);
    const homeDir=process.argv[3], bodies=[];let calls=0, logins=0;
    const fetchImpl=async(url,init)=>{
      if(url.endsWith('/api/user/me/')) return {status:200,json:async()=>({id:104})};
      if(url.endsWith('/api/user/login/')) {logins++;return {status:200,json:async()=>({token:'renewed'})};}
      bodies.push(Buffer.from(init.body));calls++;
      return {status:calls===1?401:200,text:async()=>'${SENTINEL}'};
    };
    (async()=>{try{
      const origin='https://token.test';
      const auth=createTokenSession({origin,profile:'qa104',homeDir,sources:[{kind:'value',value:'old'}],refreshPolicy:'primary-qa',fixture:{origin,fetchImpl,credentials:{email:'fixture@example.invalid',password:'${SENTINEL}'}}});
      const form=new FormData();form.append('caption','unchanged');form.append('file',new Blob([Buffer.from([0,1,2,255])],{type:'image/png'}),'fixture.png');
      await auth.request('/api/files/',{method:'POST',body:form});
      process.stdout.write(JSON.stringify({calls,logins,equal:bodies.length===2&&bodies[0].equals(bodies[1]),hasCaption:bodies[0].includes(Buffer.from('unchanged')),hasBytes:bodies[0].includes(Buffer.from([0,1,2,255]))}));
    }catch(e){process.stderr.write(formatTokenError(e));process.exitCode=1;}})();
  `)
  const result = runNodeCli([runner, path.join(ROOT, 'scripts/lib/metravel-token.js'), homeDir], { NODE_ENV: 'test' }, { cwd: ROOT })
  expect(result.status).toBe(0)
  expect(JSON.parse(result.stdout)).toEqual({ calls: 2, logins: 1, equal: true, hasCaption: true, hasBytes: true })
  expect(result.stderr).not.toContain(SENTINEL)
})

it('recovers a lock belonging to a known terminated child, without age-based stealing', async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  const pid = child.pid
  await new Promise<void>((resolve, reject) => { child.on('error', reject); child.on('close', () => resolve()) })
  fs.writeFileSync(path.join(homeDir, '.metravel_token.qa104.lock'), JSON.stringify({ pid, nonce: 'b'.repeat(48) }))
  let logins = 0
  const fetchImpl = async (url: string, init: any) => {
    if (me(url)) return response(init.headers.Authorization === 'Token renewed' ? 200 : 401, { id: 104 })
    logins++; return response(200, { token: 'renewed' })
  }
  await session(fetchImpl).ensureToken()
  expect(logins).toBe(1)
  expect(fs.existsSync(path.join(homeDir, '.metravel_token.qa104.lock'))).toBe(false)
})

it('HTTPS fixture rejects a self-signed certificate even with an unsafe ambient TLS override', async () => {
  const key = path.join(homeDir, 'fixture-key.pem'), cert = path.join(homeDir, 'fixture-cert.pem')
  const generated = runCli('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { cwd: ROOT })
  expect(generated.status).toBe(0)
  const state = path.join(homeDir, 'tls-state.json')
  fs.writeFileSync(state, '0')
  const server = await startStubServer(`
    const https=require('node:https'),fs=require('node:fs');let requests=0;
    https.createServer({key:fs.readFileSync(${JSON.stringify(key)}),cert:fs.readFileSync(${JSON.stringify(cert)})},(req,res)=>{
      fs.writeFileSync(${JSON.stringify(state)},String(++requests));res.end('secret');
    }).listen(0,'127.0.0.1',function(){console.log('PORT='+this.address().port);});
  `, homeDir)
  const runner = path.join(homeDir, 'tls-client.cjs')
  fs.writeFileSync(runner, `
    const {createTokenSession,formatTokenError}=require(process.argv[2]);
    const origin=process.argv[3],homeDir=process.argv[4];
    createTokenSession({origin,profile:'owner',expectedUserId:1,homeDir,sources:[{kind:'value',value:'${SENTINEL}'}],refreshPolicy:'never',fixture:{origin}})
      .ensureToken().then(()=>{process.stdout.write('UNSAFE');process.exitCode=2;}).catch(e=>process.stdout.write(formatTokenError(e)));
  `)
  try {
    const result = runNodeCli([runner, path.join(ROOT, 'scripts/lib/metravel-token.js'), server.origin.replace('http:', 'https:'), homeDir], { NODE_ENV: 'test', NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { cwd: ROOT })
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('metravel-auth: request/network')
    expect(result.stderr).not.toContain(SENTINEL)
    expect(fs.readFileSync(state, 'utf8')).toBe('0')
  } finally { server.stop() }
}, 15000)

it('an external observer never reads a partial token during repeated atomic cache publication', async () => {
  const cache = path.join(homeDir, 'atomic-cache')
  const a = 'a'.repeat(4096), b = 'b'.repeat(4096)
  fs.writeFileSync(cache, a)
  const observer = path.join(homeDir, 'observer.cjs')
  fs.writeFileSync(observer, `
    const fs=require('node:fs');let reads=0,bad=0;
    process.stdout.write('ready'+String.fromCharCode(10));
    const loop=setInterval(()=>{const value=fs.readFileSync(process.argv[2],'utf8');reads++;if(value!=='a'.repeat(4096)&&value!=='b'.repeat(4096))bad++;},1);
    process.stdin.resume();process.stdin.on('data',()=>{clearInterval(loop);process.stdout.write(JSON.stringify({reads,bad}));process.exit(0);});
  `)
  const child = spawn(process.execPath, [observer, cache], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('observer ready deadline')), 2000)
      child.on('error', (error) => { clearTimeout(timer); reject(error) })
      child.once('close', () => { clearTimeout(timer); reject(new Error(`observer exited before ready: ${stderr}`)) })
      child.stdout.once('data', () => { clearTimeout(timer); resolve() })
    })
    for (let index = 0; index < 40; index++) {
      atomicPublish([{ file: cache, bytes: Buffer.from(index % 2 ? a : b) }])
      await new Promise((resolve) => setTimeout(resolve, 2))
    }
    child.stdin.end('stop')
    await new Promise<void>((resolve) => child.on('close', () => resolve()))
    const observations = JSON.parse(stdout.split('\n')[1])
    expect(observations.reads).toBeGreaterThan(10)
    expect(observations.bad).toBe(0)
    expect(stderr).toBe('')
    expect(fs.statSync(cache).mode & 0o777).toBe(0o600)
    expect(fs.readdirSync(homeDir).filter((name) => name.endsWith('.tmp'))).toEqual([])
  } finally { if (child.exitCode == null) child.kill() }
}, 10000)


// TC1: real operational target policy is independent from test transport.
it.each(['https://unknown.example', 'http://192.168.50.36:8000', 'http://127.0.0.1:8000', 'http://localhost:8001'])('rejects undeclared operational target %s', (origin) => {
  expect(() => targetPolicy(origin)).toThrow('configure/origin')
})
it('approved local target is explicit-only and cannot consume ambient/cache credentials', async () => {
  const origin = 'http://localhost:8000'
  expect(targetPolicy(origin)).toMatchObject({ origin, local: true, production: false, fixture: false })
  const auth = createTokenSession({ origin, profile: 'qa104', sources: [], refreshPolicy: 'never' })
  await expect(auth.ensureToken()).rejects.toThrow('verify/missing-token')
  for (const sources of [[{ kind: 'env', name: 'METRAVEL_TOKEN' }], [{ kind: 'file', path: path.join(homeDir, 'local-token') }]]) {
    expect(() => createTokenSession({ origin, profile: 'qa104', sources })).toThrow('configure/configuration')
  }
  expect(() => createTokenSession({ origin, profile: 'qa104', sources: [], refreshPolicy: 'primary-qa' })).toThrow('configure/configuration')
  expect(() => createTokenSession({ origin, profile: 'qa104', sources: [], credentials: { env: {} } })).toThrow('configure/configuration')
  expect(fs.readdirSync(homeDir)).toEqual([])
})
it('NODE_ENV=production local CLI uses only its explicit token and public reads without fixture mode', async () => {
  const ledger = path.join(homeDir, 'local-ledger.json')
  const server = await startStubServer(`
    const http=require('node:http'),fs=require('node:fs');const ledger=[];
    http.createServer((req,res)=>{ledger.push({path:req.url,auth:req.headers.authorization||null});fs.writeFileSync(${JSON.stringify(ledger)},JSON.stringify(ledger));
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(req.url==='/api/user/me/'?{id:104}:req.url.startsWith('/api/quests/translations/status/')?[]:{results:[],next:null}));
    }).listen(0,'127.0.0.1',function(){console.log('PORT='+this.address().port);});
  `, homeDir)
  const runner = path.join(homeDir, 'operational-local.cjs')
  fs.writeFileSync(runner, `
    const http=require('node:http'),native=http.request;
    // Only the child fixture's socket destination is mapped to an isolated port.
    // The core sees the exact operational URL/Host and no fixture injection.
    http.request=(url,options,callback)=>{const target=new URL(url);if(target.origin!=='http://localhost:8000')throw new Error('foreign target');
      return native(${JSON.stringify(server.origin)}+target.pathname+target.search,{...options,headers:{...options.headers,Host:'localhost:8000'}},callback);};
    const {run,parseArgs}=require(process.argv[2]);
    run(parseArgs(['status','--json','--api-url','http://localhost:8000','--token','local-manufactured-token'])).catch(e=>{process.stderr.write(e.message);process.exitCode=1;});
  `)
  try {
    const result = runNodeCli([runner, path.join(ROOT, 'scripts/quest-translate.js')], { NODE_ENV: 'production', METRAVEL_TOKEN: SENTINEL, E2E_EMAIL: SENTINEL, E2E_PASSWORD: SENTINEL, HOME: homeDir }, { cwd: ROOT })
    expect(result.status).toBe(0)
    expect(result.stdout + result.stderr).not.toContain(SENTINEL)
    const seen = JSON.parse(fs.readFileSync(ledger, 'utf8'))
    expect(seen.filter((entry: any) => entry.path.includes('login'))).toEqual([])
    expect(seen.find((entry: any) => entry.path === '/api/user/me/').auth).toBe('Token local-manufactured-token')
    expect(seen.find((entry: any) => entry.path.startsWith('/api/quests/?')).auth).toBeNull()
    expect(fs.readdirSync(homeDir).filter((name) => name.startsWith('.metravel'))).toEqual([])
  } finally { server.stop() }
}, 10000)

// TC3: external generations and self-aliasing cannot be silently rolled back.
it.each([false, true])('second rename failure preserves the correct owned/foreign generation (foreign=%s)', (foreign) => {
  const canonicalHome = fs.realpathSync(homeDir)
  const first = path.join(canonicalHome, 'first'), second = path.join(canonicalHome, 'second')
  fs.writeFileSync(first, 'original-a');fs.writeFileSync(second, 'original-b')
  const rename = fs.renameSync.bind(fs)
  const spy = jest.spyOn(fs, 'renameSync').mockImplementation((from: any, to: any) => {
    if (String(to) === second) {
      if (foreign) { const external = path.join(homeDir, 'foreign'); fs.writeFileSync(external, 'foreign-new'); rename(external, first) }
      throw new Error(SENTINEL)
    }
    return rename(from, to)
  })
  try {
    let error: any
    try { atomicPublish([{ file: first, bytes: Buffer.from('owned-new') }, { file: second, bytes: Buffer.from('owned-second') }]) } catch (caught) { error = caught }
    expect(formatTokenError(error)).not.toContain(SENTINEL)
    expect(error).toBeDefined()
    expect(fs.readFileSync(first, 'utf8')).toBe(foreign ? 'foreign-new' : 'original-a')
    expect(fs.readFileSync(second, 'utf8')).toBe('original-b')
    expect(fs.readdirSync(homeDir).filter((name) => /\.(tmp|restore)$/.test(name))).toEqual([])
  } finally { spy.mockRestore() }
})
it('duplicate normalized paths and existing hardlink aliases are rejected before publication', () => {
  const first = path.join(homeDir, 'first'), alias = path.join(homeDir, 'alias')
  fs.writeFileSync(first, 'original');fs.linkSync(first, alias)
  for (const other of [path.join(homeDir, '.', 'first'), alias]) {
    expect(() => atomicPublish([{ file: first, bytes: Buffer.from('new') }, { file: other, bytes: Buffer.from('other') }])).toThrow('persist/cache')
    expect(fs.readFileSync(first, 'utf8')).toBe('original')
  }
  expect(fs.readdirSync(homeDir).sort()).toEqual(['alias', 'first'])
})

// TC4: use manufactured external temp sentinels, never actual home caches.
it('fixture parent symlink escape is rejected before any token read or network', () => {
  const external = makeTempDir('metravel-external-fixture-')
  const fetchImpl = jest.fn()
  try {
    fs.writeFileSync(path.join(external, '.metravel_token'), SENTINEL)
    fs.symlinkSync(external, path.join(homeDir, 'link'))
    const readSpy = jest.spyOn(fs, 'readFileSync')
    try {
      expect(() => session(fetchImpl, { sources: [{ kind: 'file', path: path.join(homeDir, 'link', '.metravel_token'), format: 'plain' }] })).toThrow()
      expect(readSpy.mock.calls.some((call: any) => typeof call[0] === 'string' && call[0].includes('.metravel_token'))).toBe(false)
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally { readSpy.mockRestore() }
    expect(fs.readFileSync(path.join(external, '.metravel_token'), 'utf8')).toBe(SENTINEL)
  } finally { removeDir(external) }
})
it('fixture external writable alias and ambient env are rejected before verification/publication', () => {
  const external = makeTempDir('metravel-external-write-'), file = path.join(external, 'alias')
  const fetchImpl = jest.fn()
  try {
    fs.writeFileSync(file, SENTINEL)
    expect(() => session(fetchImpl, { writableCaches: [{ path: file, format: 'plain', authority: 'verified-binding' }] })).toThrow('configure/configuration')
    expect(() => session(fetchImpl, { sources: [{ kind: 'env', name: 'METRAVEL_TOKEN', env: process.env }] })).toThrow('configure/configuration')
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(fs.readFileSync(file, 'utf8')).toBe(SENTINEL)
  } finally { removeDir(external) }
})

// TC6: mirror the server email trim BEFORE identity/login networking.
it.each([
  { email: ' Owner@Example.invalid ', ownerEmail: 'owner@example.invalid' },
  { email: 'qa@example.invalid', ownerEmail: '   ' },
  { email: '   ', ownerEmail: 'owner@example.invalid' },
  { email: undefined, ownerEmail: 'owner@example.invalid' },
  { email: 104, ownerEmail: 'owner@example.invalid' },
  { email: 'qa@example.invalid', ownerEmail: 1 },
  { email: 'qa@example.invalid\n', ownerEmail: 'owner@example.invalid' },
])('bad or owner primary identity fails before any network: %j', (values) => {
  const fetchImpl = jest.fn()
  expect(() => session(fetchImpl, { fixture: { origin: 'https://token.test', fetchImpl, credentials: { ...values, password: SENTINEL } } })).toThrow('login/credentials')
  expect(fetchImpl).not.toHaveBeenCalled()
  expect(fs.readdirSync(homeDir)).toEqual([])
})
it('normalizes distinct primary and owner emails while leaving password bytes unchanged', () => {
  expect(normalizeLoginCredentials({ email: ' QA@example.invalid ', ownerEmail: ' OWNER@example.invalid ', password: ' spaced password ' })).toEqual({ email: 'QA@example.invalid', password: ' spaced password ' })
})

it.each([undefined, '', ' ', 120, 'OWNER@example.invalid\n'])('missing/malformed owner authority rejects production credentials before network: %j', (ownerEmail) => {
  expect(() => createTokenSession({ origin: 'https://metravel.by', profile: 'qa104', sources: [], refreshPolicy: 'primary-qa',
    credentials: { env: { E2E_EMAIL: 'qa@example.invalid', E2E_PASSWORD: SENTINEL, E2E_EMAIL2: ownerEmail } } })).toThrow('login/credentials')
  expect(fs.readdirSync(homeDir)).toEqual([])
})

it.each([true, false])('a live choosing/ticket claim blocks acquisition without age-based stealing (choosing=%s)', async (choosing) => {
  const lock = path.join(homeDir, '.metravel_token.qa104.lock'), directory = `${lock}.claims`
  fs.mkdirSync(directory, { mode: 0o700 })
  const nonce = 'c'.repeat(48)
  const file = path.join(directory, `${process.pid}-${nonce}.json`)
  const bytes = JSON.stringify({ pid: process.pid, nonce, birth: processIdentity(process.pid), choosing, ticket: choosing ? 0 : 1 })
  fs.writeFileSync(file, bytes)
  fs.utimesSync(file, new Date(0), new Date(0))
  const work = jest.fn()
  await expect(withRefreshLock(lock, Date.now() + 120, work)).rejects.toThrow('refresh/lock')
  expect(work).not.toHaveBeenCalled()
  expect(fs.readFileSync(file, 'utf8')).toBe(bytes)
  expect(fs.existsSync(lock)).toBe(false)
})
it('PID reuse with a different OS birth identity is stale despite kill(0) success', async () => {
  const lock = path.join(homeDir, '.metravel_token.qa104.lock'), directory = `${lock}.claims`
  fs.mkdirSync(directory, { mode: 0o700 })
  const nonce = 'd'.repeat(48)
  fs.writeFileSync(path.join(directory, `${process.pid}-${nonce}.json`), JSON.stringify({ pid: process.pid, nonce, birth: `${processIdentity(process.pid)}-prior-generation`, choosing: true, ticket: 0 }))
  const work = jest.fn(async () => 'acquired')
  await expect(withRefreshLock(lock, Date.now() + 1500, work)).resolves.toBe('acquired')
  expect(work).toHaveBeenCalledTimes(1)
  expect(fs.existsSync(lock)).toBe(false)
})
it.each(['not-json', '{}', '{"pid":1,"nonce":"bad"}'])('malformed election claim is fail-closed and masked: %s', async (bytes) => {
  const lock = path.join(homeDir, '.metravel_token.qa104.lock'), directory = `${lock}.claims`
  fs.mkdirSync(directory, { mode: 0o700 })
  const file = path.join(directory, 'malformed.json');fs.writeFileSync(file, bytes)
  const work = jest.fn()
  let error: any
  try { await withRefreshLock(lock, Date.now() + 1000, work) } catch (caught) { error = caught }
  expect(formatTokenError(error)).toBe('metravel-auth: refresh/lock')
  expect(work).not.toHaveBeenCalled()
  expect(fs.readFileSync(file, 'utf8')).toBe(bytes)
})

async function untilFile(file: string, deadlineMs = 4000) {
  const until = Date.now() + deadlineMs
  while (!fs.existsSync(file)) {
    if (Date.now() >= until) throw new Error('fixture barrier deadline')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
function fixtureChild(file: string, modulePath: string, config: any, environment: Record<string, string> = {}) {
  const child = spawn(process.execPath, [file, modulePath], { env: { ...process.env, ...environment, NODE_ENV: 'test' }, stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
  const finished = new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('fixture child deadline')) }, 10000)
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('close', (code: number) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
  })
  // Attach the rejection handler immediately; barriers may intentionally kill a
  // paused child, and no unhandled promise may escape cleanup.
  finished.catch(() => {})
  child.stdin.end(JSON.stringify(config))
  return { child, finished }
}

it.each(['afterChoosing', 'afterTicket'])('crash at %s election stage recovers without unlinking another generation', async (stage) => {
  const lock = path.join(homeDir, '.metravel_token.qa104.lock'), ready = path.join(homeDir, 'ready')
  const runner = path.join(homeDir, 'crash-election.cjs')
  fs.writeFileSync(runner, `
    const fs=require('node:fs'),{withRefreshLock}=require(process.argv[2]);let raw='';
    process.stdin.on('data',c=>raw+=c);process.stdin.on('end',()=>{const cfg=JSON.parse(raw);
      withRefreshLock(cfg.lock,Date.now()+30000,async()=>{}, {[cfg.stage]:async()=>{fs.writeFileSync(cfg.ready,'ready');await new Promise(()=>{});}}).catch(()=>{});
      setInterval(()=>{},1000);
    });
  `)
  const paused = fixtureChild(runner, path.join(ROOT, 'scripts/lib/metravel-token-cache.js'), { lock, ready, stage })
  try {
    await untilFile(ready)
    paused.child.kill()
    await paused.finished
    const work = jest.fn(async () => 'recovered')
    await expect(withRefreshLock(lock, Date.now() + 2000, work)).resolves.toBe('recovered')
    expect(work).toHaveBeenCalledTimes(1)
    expect(fs.existsSync(lock)).toBe(false)
  } finally { if (paused.child.exitCode == null) paused.child.kill() }
}, 12000)

it('competing stale inspectors cannot remove the live recovered generation: three real children, exactly one login', async () => {
  const dead = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  const deadPid = dead.pid
  await new Promise<void>((resolve, reject) => { dead.on('error', reject); dead.on('close', () => resolve()) })
  const lock = path.join(homeDir, '.metravel_token.qa104.lock')
  fs.writeFileSync(lock, JSON.stringify({ pid: deadPid, nonce: 'e'.repeat(48) }))
  const inspected = path.join(homeDir, 'inspected-a'), releaseA = path.join(homeDir, 'release-a')
  const loginStarted = path.join(homeDir, 'login-started'), releaseLogin = path.join(homeDir, 'release-login')
  const ledger = path.join(homeDir, 'election-ledger.json')
  const server = await startStubServer(`
    const http=require('node:http'),fs=require('node:fs');let logins=0,writes=0;
    http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
      let status=200,out={id:104};
      const finish=()=>{fs.writeFileSync(${JSON.stringify(ledger)},JSON.stringify({logins,writes}));res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(out));};
      if(req.url==='/api/user/login/'){logins++;out={token:'renewed'};fs.writeFileSync(${JSON.stringify(loginStarted)},'ready');fs.writeFileSync(${JSON.stringify(ledger)},JSON.stringify({logins,writes}));
        const start=Date.now(),timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(releaseLogin)})||Date.now()-start>6000){clearInterval(timer);finish();}},5);return;}
      if(req.headers.authorization!=='Token renewed'){status=401;out={detail:'fixture-expired'};}
      else if(req.url==='/api/quests/1/'){writes++;out={ok:true};}finish();
    });}).listen(0,'127.0.0.1',function(){console.log('PORT='+this.address().port);});
  `, homeDir)
  const runner = path.join(homeDir, 'election-child.cjs')
  fs.writeFileSync(runner, `
    const fs=require('node:fs'),{createTokenSession,formatTokenError}=require(process.argv[2]);let raw='';
    const wait=async file=>{const start=Date.now();while(!fs.existsSync(file)){if(Date.now()-start>6000)throw new Error('barrier');await new Promise(r=>setTimeout(r,5));}};
    process.stdin.on('data',c=>raw+=c);process.stdin.on('end',async()=>{try{const cfg=JSON.parse(raw);
      if(cfg.pauseInspect)cfg.fixture.lockHooks={afterInspect:async()=>{fs.writeFileSync(cfg.pauseInspect,'ready');await wait(cfg.releaseInspect);}};
      await createTokenSession(cfg).request('/api/quests/1/',{method:'PUT',json:{unchanged:true}});process.stdout.write('ready');
    }catch(e){process.stderr.write(formatTokenError(e));process.exitCode=1;}});
  `)
  const children: ReturnType<typeof fixtureChild>[] = []
  const config = { origin: server.origin, homeDir, profile: 'qa104', sources: [{ kind: 'value', value: 'expired' }], refreshPolicy: 'primary-qa', fixture: { origin: server.origin, credentials: { email: 'fixture@example.invalid', password: SENTINEL } } }
  try {
    children.push(fixtureChild(runner, path.join(ROOT, 'scripts/lib/metravel-token.js'), { ...config, pauseInspect: inspected, releaseInspect: releaseA }))
    await untilFile(inspected)
    children.push(fixtureChild(runner, path.join(ROOT, 'scripts/lib/metravel-token.js'), config))
    await untilFile(loginStarted)
    const generation = readRegular(lock)
    expect(JSON.parse(generation.bytes.toString()).pid).toBe(children[1].child.pid)
    fs.writeFileSync(releaseA, 'go')
    children.push(fixtureChild(runner, path.join(ROOT, 'scripts/lib/metravel-token.js'), config))
    const claimDirectory = `${fs.realpathSync(homeDir)}/.metravel_token.qa104.lock.claims`
    const deadline = Date.now() + 4000
    while (fs.readdirSync(claimDirectory).filter((name) => name.endsWith('.json')).length < 3) {
      if (Date.now() > deadline) throw new Error('three claim barrier deadline')
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const live = readRegular(lock)
    expect(live.stat.ino).toBe(generation.stat.ino)
    expect(live.bytes.equals(generation.bytes)).toBe(true)
    expect(JSON.parse(fs.readFileSync(ledger, 'utf8')).logins).toBe(1)
    fs.writeFileSync(releaseLogin, 'go')
    expect(await Promise.all(children.map(({ finished }) => finished))).toEqual([
      { code: 0, stdout: 'ready', stderr: '' }, { code: 0, stdout: 'ready', stderr: '' }, { code: 0, stdout: 'ready', stderr: '' },
    ])
    expect(JSON.parse(fs.readFileSync(ledger, 'utf8'))).toEqual({ logins: 1, writes: 3 })
    expect(fs.existsSync(lock)).toBe(false)
    expect(fs.readdirSync(claimDirectory)).toEqual([])
  } finally {
    fs.writeFileSync(releaseA, 'cleanup');fs.writeFileSync(releaseLogin, 'cleanup')
    children.forEach(({ child }) => { if (child.exitCode == null) child.kill() })
    await Promise.allSettled(children.map(({ finished }) => finished))
    server.stop()
  }
}, 15000)


it('failed rollback preparation/rename cleans its own restore temp and reports terminal failure', () => {
  const canonicalHome = fs.realpathSync(homeDir)
  const first = path.join(canonicalHome, 'first'), second = path.join(canonicalHome, 'second')
  fs.writeFileSync(first, 'original-a');fs.writeFileSync(second, 'original-b')
  const rename = fs.renameSync.bind(fs)
  const spy = jest.spyOn(fs, 'renameSync').mockImplementation((from: any, to: any) => {
    if (String(to) === second || String(from).endsWith('.restore')) throw new Error(SENTINEL)
    return rename(from, to)
  })
  try {
    let error: any
    try { atomicPublish([{ file: first, bytes: Buffer.from('published-a') }, { file: second, bytes: Buffer.from('published-b') }]) } catch (caught) { error = caught }
    expect(formatTokenError(error)).toBe('metravel-auth: refresh/cache')
    expect(fs.readFileSync(first, 'utf8')).toBe('published-a')
    expect(fs.readFileSync(second, 'utf8')).toBe('original-b')
    expect(fs.readdirSync(homeDir).filter((name) => /\.(tmp|restore)$/.test(name))).toEqual([])
  } finally { spy.mockRestore() }
})
it('login sends normalized distinct primary email and unchanged password, then verifies id104', async () => {
  const calls: string[] = [], bodies: any[] = []
  const fetchImpl = async (url: string, init: any) => {
    calls.push(new URL(url).pathname)
    if (login(url)) { bodies.push(JSON.parse(Buffer.from(init.body).toString())); return response(200, { token: 'verified' }) }
    return response(200, { id: 104 })
  }
  const auth = session(fetchImpl, { sources: [], fixture: { origin: 'https://token.test', fetchImpl, credentials: { email: ' QA@example.invalid ', ownerEmail: ' OWNER@example.invalid ', password: ' spaced-password ' } } })
  await auth.ensureToken()
  expect(calls).toEqual(['/api/user/login/', '/api/user/me/'])
  expect(bodies).toEqual([{ email: 'QA@example.invalid', password: ' spaced-password ' }])
  expect(fs.readFileSync(path.join(homeDir, '.metravel_token.qa104'), 'utf8')).toBe('verified\n')
})

it('different timezone and locale children identify the same live owner and preserve its exclusive generation (TC7)', async () => {
  const lock = path.join(homeDir, '.metravel_token.qa104.lock')
  const held = path.join(homeDir, 'cross-env-held'), release = path.join(homeDir, 'cross-env-release')
  const observed = path.join(homeDir, 'cross-env-birth'), waiting = path.join(homeDir, 'cross-env-waiting')
  const entered = path.join(homeDir, 'cross-env-entered')
  const runner = path.join(homeDir, 'cross-env-child.cjs')
  fs.writeFileSync(runner, `
    const fs=require('node:fs'),{withRefreshLock,processIdentity}=require(process.argv[2]);let raw='';
    const wait=async file=>{const deadline=Date.now()+6000;while(!fs.existsSync(file)){if(Date.now()>deadline)throw new Error('fixture barrier');await new Promise(r=>setTimeout(r,5));}};
    process.stdin.on('data',c=>raw+=c);process.stdin.on('end',async()=>{try{const cfg=JSON.parse(raw);
      if(cfg.ownerPid){
        // Publish the barrier only after its identity bytes exist: an existence
        // poll may otherwise observe writeFileSync's newly opened empty file.
        fs.writeFileSync(cfg.observed+'.tmp',processIdentity(cfg.ownerPid));
        fs.renameSync(cfg.observed+'.tmp',cfg.observed);
      }
      await withRefreshLock(cfg.lock,Date.now()+7000,async()=>{
        if(cfg.hold){fs.writeFileSync(cfg.held,'held');await wait(cfg.release);}
        else fs.writeFileSync(cfg.entered,'entered');
      },cfg.hold?{}:{afterTicket:async()=>{fs.writeFileSync(cfg.waiting,'waiting');}});
      process.stdout.write('ready');
    }catch(e){process.stderr.write('fixture lock failed');process.exitCode=1;}});
  `)
  const children: ReturnType<typeof fixtureChild>[] = []
  try {
    const holder = fixtureChild(runner, path.join(ROOT, 'scripts/lib/metravel-token-cache.js'),
      { lock, hold: true, held, release }, { TZ: 'UTC', LC_ALL: 'C', LANG: 'C' })
    children.push(holder)
    await untilFile(held)
    const generation = readRegular(lock)
    const owner = JSON.parse(generation.bytes.toString())
    expect(owner.pid).toBe(holder.child.pid)
    const contender = fixtureChild(runner, path.join(ROOT, 'scripts/lib/metravel-token-cache.js'),
      { lock, ownerPid: owner.pid, observed, waiting, entered },
      { TZ: 'America/Los_Angeles', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' })
    children.push(contender)
    await untilFile(observed)
    // These are actual OS birth observations from different processes, not
    // mocked dates or a PID-only comparison. A live generation must be invariant.
    expect(fs.readFileSync(observed, 'utf8')).toBe(owner.birth)
    await untilFile(waiting)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(() => process.kill(owner.pid, 0)).not.toThrow()
    expect(fs.existsSync(entered)).toBe(false)
    const current = readRegular(lock)
    expect(current.stat.ino).toBe(generation.stat.ino)
    expect(current.bytes.equals(generation.bytes)).toBe(true)
    fs.writeFileSync(release, 'release')
    expect(await Promise.all(children.map(({ finished }) => finished))).toEqual([
      { code: 0, stdout: 'ready', stderr: '' }, { code: 0, stdout: 'ready', stderr: '' },
    ])
    expect(fs.readFileSync(entered, 'utf8')).toBe('entered')
    expect(fs.existsSync(lock)).toBe(false)
    expect(fs.readdirSync(`${fs.realpathSync(homeDir)}/.metravel_token.qa104.lock.claims`)).toEqual([])
  } finally {
    fs.writeFileSync(release, 'cleanup')
    children.forEach(({ child }) => { if (child.exitCode == null) child.kill() })
    await Promise.allSettled(children.map(({ finished }) => finished))
  }
}, 15000)
