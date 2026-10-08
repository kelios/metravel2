#!/usr/bin/env node
/**
 * Синхронизирует текстовые поля шагов квеста «Варшава» с исходником
 * scripts/warsaw-quest-data.js: PATCH task / hint / answer_pattern / input_type
 * по step_id. Не трогает story/координаты/медиа. Идемпотентно.
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/update-warsaw-steps.js \
 *   --api-url=https://metravel.by --token=YOUR_TOKEN [--dry-run]
 */

const { rethrowTerminalAuthError, createToolSession, publicRequest, TokenError, formatTokenError  } = require('./lib/metravel-tool-session')

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by';

function createSession() {
  return createToolSession({ origin: API_BASE, explicit: tokenArg ? tokenArg.split('=').slice(1).join('=') : undefined })
}
const SESSION = createSession();


const QUESTS = require('./warsaw-quest-data.js');

async function apiGet(endpoint) {
    const headers = {};
    const r = await (isDryRun ? publicRequest(API_BASE, `${API_BASE}${endpoint}`, { headers }) : SESSION.request(`${API_BASE}${endpoint}`, { headers }));
    if (!r.ok) throw new TokenError('response', { status: r.status });
    return r.json();
}

async function apiPatch(endpoint, payload) {
    if (isDryRun) { console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 120)); return {}; }
    const headers = { 'Content-Type': 'application/json' };
    const r = await SESSION.request(`${API_BASE}${endpoint}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (!r.ok) { throw new TokenError('response', { status: r.status }); }
    return r.json();
}

function inputTypeFor(step) {
    if (step.inputType) return step.inputType;
    const t = step.answer_pattern && step.answer_pattern.type;
    return (t === 'range' || t === 'exact' || t === 'any_number') ? 'number' : 'text';
}

async function main() {
    console.log(`🔄 Sync Warsaw steps → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'})\n`);
    for (const q of QUESTS) {
        const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(q.quest_id)}/`);
        let steps = bundle.steps;
        if (typeof steps === 'string') steps = JSON.parse(steps);
        const pkByStepId = {};
        for (const s of steps) pkByStepId[s.step_id] = s.id;

        for (const s of q.steps) {
            const pk = pkByStepId[s.step_id];
            if (!pk) { console.log(`  ⚠️  ${s.step_id}: no pk on backend`); continue; }
            try {
                await apiPatch(`/api/quest-steps/${pk}/`, {
                    task: s.task,
                    hint: s.hint || null,
                    answer_pattern: JSON.stringify(s.answer_pattern || { type: 'any', value: '' }),
                    input_type: inputTypeFor(s),
                });
                console.log(`  ✅ ${s.step_id} (pk ${pk})`);
            } catch (e) {
              rethrowTerminalAuthError(e);
                console.error(`  ❌ ${s.step_id}: ${e.message}`);
            }
        }
    }
    console.log('\n✅ Done');
}
main().catch(e => { console.error('Fatal:', formatTokenError(e)); process.exit(1); });
