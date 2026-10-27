/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeDir, runCli, startStubServer, type StubServer } from './cli-test-utils';

const sha = 'a'.repeat(40);
const source = fs.readFileSync(path.resolve('build-prod.sh'), 'utf8');
const shellFunction = (name: string) => {
  const start = source.indexOf(`${name}() {`);
  const terminator = name === 'deploy_prod' ? source.indexOf('\nREMOTE_DEPLOY_SCRIPT\n', start) : start;
  const end = source.indexOf('\n}\n', terminator);
  if (start < 0 || end < 0) throw new Error(`Missing real build function ${name}`);
  return source.slice(start, end + 3);
};

describe('actual code publisher and verifier protocol during a concurrent content refresh', () => {
  let fixture: string;
  let server: StubServer;
  beforeEach(async () => {
    fixture = makeTempDir('run-', { root: path.resolve('.codex-temp/ssr-code-publication') });
    const fakeBash = `#!/bin/sh
printf '%s\\n' "$2" >> "$SSR_PIPELINE_ACTIONS"
case "$2" in
capability) printf '%s\\n' '{"schema_version":2,"available":true,"enabled":true,"quest_web":{"schema_version":2,"builder_schema":2,"refresh_max_age_seconds":30,"control_path":"/quests/7/fixture-city-walk"}}';;
verify-code) if [ "$SSR_PIPELINE_BAD_PROOF" = 1 ]; then renderer=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; else renderer=${sha}; fi
printf '{"schema_version":1,"status":"ok","sha":"${sha}","client_sha":"${sha}","renderer_sha":"%s","dirty":false}\\n' "$renderer";;
esac
`;
    fs.writeFileSync(path.join(fixture, 'bash'), fakeBash, { mode: 0o755 });
    server = await startStubServer(`
const http = require('node:http');
const sha = ${JSON.stringify(sha)};
const server = http.createServer((req, res) => {
  const origin = 'http://' + req.headers.host;
  const pathname = new URL(req.url, origin).pathname;
  res.setHeader('Cache-Control', 'no-store');
  if (pathname === '/api/travels/') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({results:[{slug:'example'}]})); return;
  }
  if (pathname.startsWith('/api/quests/web/')) {
    res.writeHead(503, {'Content-Type':'application/json','Retry-After':'5'});
    res.end(JSON.stringify({schema_version:2,state:'temporary_failure',kind:'detail',locale:'ru',page:null,versions:[],error_code:'refresh_pending',source_checked_at:1000,source_age_seconds:2})); return;
  }
  const canonical = origin + '/travels/example';
  const {state, reason} = JSON.parse(require('node:fs').readFileSync(${JSON.stringify(path.join(fixture, 'state'))}, 'utf8'));
  const graph = {'@graph':[{'@type':'Article',headline:'Article',url:canonical,mainEntityOfPage:canonical},{'@type':'BreadcrumbList',itemListElement:[{item:canonical}]}]};
  res.writeHead(200, {'Content-Type':'text/html','X-Metravel-Ssr-Source':sha,'X-Metravel-Travel-Graph-State':state,'Retry-After':'5'});
  res.end('<html><head><link rel="canonical" href="'+canonical+'"></head><body><h1>Article</h1><div data-ssr-html-island="description"><p>Published body remains available.</p></div><section data-travel-link-graph="'+state+'" data-travel-graph-error="'+reason+'"></section><script type="application/ld+json" data-seo-jsonld="travel-article">'+JSON.stringify(graph)+'</script></body></html>');
}); server.listen(0,'127.0.0.1',()=>console.log('PORT='+server.address().port));
`, fixture);
  });
  afterEach(() => { server?.stop(); removeDir(fixture); });

  it.each([
    { bad: false, state: 'pending', reason: 'refresh_pending', rollback: false },
    { bad: false, state: 'available', reason: '', rollback: false },
    { bad: true, state: 'pending', reason: 'refresh_pending', rollback: true },
    { bad: false, state: 'error', reason: 'invalid_graph_response', rollback: true },
  ])('publishes or rolls back through the real shell and CLI according to the proved failure: %j', ({ bad, state, reason, rollback }) => {
    fs.writeFileSync(path.join(fixture, 'state'), JSON.stringify({ state, reason }));
    const runner = path.join(fixture, 'publish.sh');
    fs.writeFileSync(runner, `set -euo pipefail
node() {
  case "$1" in
    scripts/verify-live-*.js) "$SSR_PIPELINE_NODE" "$@" --origin "$SSR_PIPELINE_ORIGIN";;
    *) "$SSR_PIPELINE_NODE" "$@";;
  esac
}
${shellFunction('verify_quest_runtime')}
${shellFunction('deploy_prod')}
deploy_prod prod
`);
    const actions = path.join(fixture, 'actions');
    const result = runCli('/bin/bash', [runner], { cwd: process.cwd(), timeoutMs: 10000, env: {
      PATH: `${fixture}${path.delimiter}${process.env.PATH}`, SSR_PIPELINE_ACTIONS: actions,
      SSR_PIPELINE_BAD_PROOF: bad ? '1' : '0', SSR_PIPELINE_NODE: process.execPath,
      SSR_PIPELINE_ORIGIN: server.origin, SSR_CODE_RELEASE: '1', BUILD_SOURCE_SHA: sha, SSR_RELEASE_DIR: fixture,
    } });
    if (!fs.existsSync(actions)) throw new Error(result.stderr || result.stdout || 'Publisher did not invoke its transport');
    const calls = fs.readFileSync(actions, 'utf8').trim().split('\n');
    expect(calls).toContain('publish-code');
    expect(calls).toContain('verify-code');
    if (rollback) {
      expect(result.status).not.toBe(0);
      expect(calls).toContain('rollback-code');
      expect(calls).not.toContain('finalize-code');
    } else {
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('content=pending');
      expect(calls).toContain('finalize-code');
      expect(calls).not.toContain('rollback-code');
    }
  });
});
