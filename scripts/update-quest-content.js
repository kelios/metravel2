#!/usr/bin/env node
/**
 * ОБНОВЛЕНИЕ контента существующего квеста на проде (в отличие от migrate-*,
 * который только создаёт и пропускает существующее). Идёт PATCH-ем по DB-id
 * шагов/интро/финала — для ревью: переписать story/task/hint, спрятать ответы,
 * сплести сквозной сюжет, уточнить координаты, согласовать answer_pattern.
 *
 * Сопоставление по step_id: данные ревью matched к шагам прода по step_id
 * (intro — по is_intro/step_id='intro'). DB-id берётся из bundle.
 *
 *   node scripts/update-quest-content.js --quest-id=<id> --data=scripts/review/<id>.json [--dry-run]
 *
 * Токен: --token=, env METRAVEL_TOKEN, .secrets/metravel-token.json, ~/.metravel_token.
 * Формат data-файла (JSON): { intro?: Step, steps: Step[], finale?: { text } }
 *   Step: { step_id, title?, location?, story?, task?, hint?, answer_pattern?:{type,value},
 *           lat?, lng?, maps_url?, input_type? } — присылаются только меняемые поля.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const get = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const API_BASE = get('api-url', 'https://metravel.by');
const QUEST_ID = get('quest-id');
const DATA_FILE = get('data');

if (!QUEST_ID || !DATA_FILE) { console.error('❌ нужны --quest-id и --data'); process.exit(1); }

function resolveToken() {
    const t = get('token');
    if (t) return t;
    if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN;
    const sec = path.resolve(__dirname, '..', '.secrets', 'metravel-token.json');
    if (fs.existsSync(sec)) return JSON.parse(fs.readFileSync(sec, 'utf8')).token;
    const home = path.join(os.homedir(), '.metravel_token');
    if (fs.existsSync(home)) return fs.readFileSync(home, 'utf8').trim();
    return null;
}
const TOKEN = resolveToken();
if (!TOKEN && !isDryRun) { console.error('❌ нет токена'); process.exit(1); }

function decimal(v) { const n = Number(v); return Number.isFinite(n) ? Number(n.toFixed(6)).toString() : undefined; }
function serializeAnswer(ap) { return ap ? JSON.stringify(ap) : undefined; }

async function apiGet(endpoint) {
    const r = await fetch(`${API_BASE}${endpoint}`, { headers: TOKEN ? { Authorization: `Token ${TOKEN}` } : {} });
    if (!r.ok) throw new Error(`HTTP ${r.status} GET ${endpoint}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
}
async function apiPatch(endpoint, payload) {
    if (isDryRun) { console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 140)); return {}; }
    const r = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
        body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} PATCH ${endpoint}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
}

// собрать PATCH-поля шага из входных данных (только присутствующие)
function stepPayload(s) {
    const p = {};
    for (const k of ['title', 'location', 'story', 'task']) if (s[k] != null) p[k] = s[k];
    if ('hint' in s) p.hint = s.hint || null;
    if (s.answer_pattern) p.answer_pattern = serializeAnswer(s.answer_pattern);
    if (s.maps_url) p.maps_url = s.maps_url;
    if (s.lat != null) p.lat = decimal(s.lat);
    if (s.lng != null) p.lng = decimal(s.lng);
    if (s.input_type) p.input_type = s.input_type;
    return p;
}

async function main() {
    console.log(`🔧 Update quest content «${QUEST_ID}» → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'})\n`);
    const data = JSON.parse(fs.readFileSync(path.resolve(DATA_FILE), 'utf8'));
    const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(QUEST_ID)}/`);
    const steps = typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps;
    const intro = typeof bundle.intro === 'string' ? JSON.parse(bundle.intro) : bundle.intro;
    const byStepId = new Map();
    if (intro) byStepId.set(intro.step_id || 'intro', intro);
    for (const s of steps) byStepId.set(s.step_id, s);

    // intro
    if (data.intro) {
        const target = intro || [...byStepId.values()].find(s => s.is_intro);
        if (!target) console.warn('  ⚠️ intro на проде не найден, пропуск');
        else { await apiPatch(`/api/quest-steps/${target.id}/`, stepPayload(data.intro)); console.log(`  ✅ intro (id=${target.id})`); }
    }
    // steps
    for (const s of data.steps || []) {
        const target = byStepId.get(s.step_id);
        if (!target) { console.warn(`  ⚠️ step_id=${s.step_id} не найден на проде, пропуск`); continue; }
        await apiPatch(`/api/quest-steps/${target.id}/`, stepPayload(s));
        console.log(`  ✅ step ${s.step_id} (id=${target.id})`);
    }
    // finale (finaleId == quest db id)
    if (data.finale && data.finale.text) {
        await apiPatch(`/api/quest-finales/${bundle.id}/`, { text: data.finale.text });
        console.log(`  ✅ finale (id=${bundle.id})`);
    }
    console.log('\n✅ Done');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
