import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils'

function runConsumer(script: string, args: string[], identity: number, failure?: number, terminalAt?: 'bundle' | 'step') {
  const homeDir = makeTempDir('token-consumer-')
  const preload = path.join(homeDir, 'preload.cjs'), statsFile = path.join(homeDir, 'stats.json')
  const secret = 'never-print-this-token'
  fs.writeFileSync(preload, `
    const helper=require(${JSON.stringify(path.resolve('scripts/lib/metravel-tool-session'))});
    const {createTokenSession}=require(${JSON.stringify(path.resolve('scripts/lib/metravel-token'))});
    const fs=require('fs');
    const counts={identity:0,login:0,mutations:0,publicReads:0};
    process.on('exit',()=>fs.writeFileSync(${JSON.stringify(statsFile)},JSON.stringify(counts)));
    helper.createToolSession=(options={})=>createTokenSession({...options,
      origin:'https://consumer.test',homeDir:${JSON.stringify(homeDir)},
      profile:options.profile||'qa104',expectedUserId:options.expectedUserId||104,
      sources:[{kind:'value',value:process.env.METRAVEL_TOKEN}],refreshPolicy:'never',
      fixture:{origin:'https://consumer.test',fetchImpl:async(url,init)=>{
        const endpoint=new URL(url).pathname;
        if(endpoint==='/api/user/me/'){counts.identity++;return new Response(JSON.stringify({id:${identity}}),{status:200});}
        if(endpoint==='/api/user/login/')counts.login++;
        if(init.method!=='GET'&&init.method!=='HEAD')counts.mutations++;
        if(${JSON.stringify(terminalAt)} && endpoint.includes('/by-quest-id/')) return new Response(JSON.stringify({id:7,steps:[],finale:null}),{status:${terminalAt === 'bundle' ? 401 : 200}});
        if(${JSON.stringify(terminalAt)} && init.method==='POST') return new Response('{}',{status:401});
        return new Response('"'+process.env.METRAVEL_TOKEN,{status:${failure || 200}});
      }}});
    helper.bodyMaintenanceSession=(options)=>helper.createToolSession({...options,profile:'owner',expectedUserId:1});
    helper.publicRequest=async()=>{counts.publicReads++;return new Response(JSON.stringify({steps:[],data:[]}),{status:200});};
  `)
  try {
    const { status, stdout, stderr } = runNodeCli(['--require', preload, script, ...args], { NODE_ENV: 'test', METRAVEL_TOKEN: secret })
    const counts = JSON.parse(fs.readFileSync(statsFile, 'utf8'))
    expect(stdout + stderr).not.toContain(secret)
    expect(fs.readdirSync(homeDir).filter((name) => name.startsWith('.metravel'))).toEqual([])
    return { status, stdout, stderr, counts }
  } finally { removeDir(homeDir) }
}

test.each([
  ['scripts/migrate-amsterdam-quest.js', 1],
  ['scripts/create-brest-guide.js', 104],
])('actual %s consumer refuses a different actor before content or login', (script, identity) => {
  const run = runConsumer(String(script), [], Number(identity))
  expect(run.status).toBe(1)
  expect(run.counts).toMatchObject({ mutations: 0, login: 0 })
})

it('maintenance dry-run reads public bundles without identity/login/cache publication', () => {
  const run = runConsumer('scripts/update-warsaw-steps.js', ['--dry-run'], 1)
  expect(run.status).toBe(0)
  expect(run.counts).toMatchObject({ identity: 0, login: 0, mutations: 0 })
  expect(run.counts.publicReads).toBeGreaterThan(0)
})

test.each([200, 500])('actual SEO HTTP%s malformed/reflected response is safely masked', (status) => {
  const run = runConsumer('scripts/seo-rename.js', ['--id', '123', '--name', 'Fixture'], 1, status)
  expect(run.status).toBe(1)
  expect(run.stderr).toContain('metravel-auth:')
  expect(run.counts.mutations).toBe(0)
})

it('SEO rejects a credential-bearing configured target before printing it', () => {
  const secret = 'configured-url-secret'
  const run = runNodeCli(['scripts/seo-rename.js', '--id', '123', '--name', 'Fixture', '--dry-run'], { METRAVEL_API: `https://user:${secret}@metravel.by` })
  expect(run.status).toBe(1)
  expect(run.stdout + run.stderr).not.toContain(secret)
})

test.each(['bundle', 'step'] as const)('actual migration stops all later writes after terminal authentication at %s', (terminalAt) => {
  const run = runConsumer('scripts/migrate-amsterdam-quest.js', [], 104, undefined, terminalAt)
  expect(run.status).toBe(1)
  expect(run.stderr).toContain('authentication')
  expect(run.counts).toMatchObject({ identity: 1, login: 0, mutations: terminalAt === 'step' ? 1 : 0 })
})
