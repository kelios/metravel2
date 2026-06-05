#!/usr/bin/env node
/**
 * Синхронизирует текстовые поля шагов квеста «Варшава» с исходником
 * scripts/warsaw-quest-data.js: PATCH task / hint / answer_pattern / input_type
 * по step_id. Не трогает story/координаты/медиа. Идемпотентно.
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/update-warsaw-steps.js \
 *   --api-url=https://metravel.by --token=YOUR_TOKEN [--dry-run]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by';

function resolveToken() {
    if (tokenArg) return tokenArg.split('=').slice(1).join('=');
    if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN;
    try {
        const p = path.join(os.homedir(), '.metravel_token');
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch { /* ignore */ }
    return null;
}
const TOKEN = resolveToken();
if (!TOKEN && !isDryRun) { console.error('❌ Need token'); process.exit(1); }

const QUESTS = require('./warsaw-quest-data.js');

async function apiGet(endpoint) {
    const headers = {};
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    const r = await fetch(`${API_BASE}${endpoint}`, { headers });
    if (!r.ok) throw new Error(`GET ${endpoint}: HTTP ${r.status}`);
    return r.json();
}

async function apiPatch(endpoint, payload) {
    if (isDryRun) { console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 120)); return {}; }
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    const r = await fetch(`${API_BASE}${endpoint}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (!r.ok) { const t = await r.text(); throw new Error(`PATCH ${endpoint}: HTTP ${r.status} ${t.slice(0, 120)}`); }
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
                console.error(`  ❌ ${s.step_id}: ${e.message}`);
            }
        }
    }
    console.log('\n✅ Done');
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
