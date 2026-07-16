#!/usr/bin/env node
/**
 * Синхронизирует контент уже залитого квеста из локального data-файла на прод.
 * В отличие от migrate-* (только создаёт), этот PATCH-ит существующие шаги по step_id:
 * story, task, hint, answer_pattern, lat, lng, maps_url; плюс intro и finale.
 * Совпадение шагов — по step_id (структура шагов НЕ меняется, только их поля).
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/sync-quest-to-prod.js \
 *   --source-file=scripts/tallinn-quest-data.js --api-url=https://metravel.by [--token=…] [--dry-run]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const sourceArg = args.find(a => a.startsWith('--source-file='));
// Порядок шагов на проде мог быть изменён после миграции, а локальный data-файл — устареть.
// Поэтому order переносим ТОЛЬКО по явному --reorder (иначе затрём правильный прод-порядок).
const doReorder = args.includes('--reorder');
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by';

if (!sourceArg) { console.error('❌ Нужен --source-file=…'); process.exit(1); }
const SOURCE_FILE = path.resolve(process.cwd(), sourceArg.split('=').slice(1).join('='));

function resolveToken() {
    if (tokenArg) return tokenArg.split('=').slice(1).join('=');
    if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN;
    try { const p = path.join(os.homedir(), '.metravel_token'); if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim(); } catch { /* ignore */ }
    return null;
}
const TOKEN = resolveToken();
if (!TOKEN && !isDryRun) { console.error('❌ Нужен токен'); process.exit(1); }

function dec(v) { const n = Number(v); return Number.isFinite(n) ? Number(n.toFixed(6)).toString() : '0'; }
function serAnswer(s) { return JSON.stringify(s.answer_pattern || { type: 'any', value: '' }); }

async function apiGet(endpoint) {
    const headers = {}; if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    const r = await fetch(`${API_BASE}${endpoint}`, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status} GET ${endpoint}: ${await r.text()}`);
    return r.json();
}
async function apiPatch(endpoint, payload) {
    if (isDryRun) { console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 120)); return {}; }
    const headers = { 'Content-Type': 'application/json' }; if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    const r = await fetch(`${API_BASE}${endpoint}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`HTTP ${r.status} PATCH ${endpoint}: ${await r.text()}`);
    return r.json();
}

const QUESTS = require(SOURCE_FILE);

function stepPayload(s, order) {
    const apType = (s.answer_pattern || {}).type;
    const inputType = s.inputType || (apType === 'range' || apType === 'exact' || apType === 'any_number' ? 'number' : 'text');
    const payload = {
        title: s.title, location: s.location, story: s.story, task: s.task,
        hint: s.hint || null, answer_pattern: serAnswer(s),
        lat: dec(s.lat), lng: dec(s.lng),
        maps_url: s.mapsUrl || `https://maps.google.com/?q=${s.lat},${s.lng}`,
        input_type: inputType,
    };
    // poi_info из data-файла синкается как есть (контракт: is_museum об. bool,
    // opening_hours/ticket_price/website опц.); отсутствует в данных — поле не трогаем
    const poiInfo = s.poi_info || s.poiInfo;
    if (poiInfo !== undefined) payload.poi_info = poiInfo;
    if (order !== undefined) payload.order = order;
    return payload;
}

async function main() {
    for (const q of QUESTS) {
        console.log(`\n📋 sync ${q.quest_id} → ${API_BASE} (${isDryRun ? 'DRY' : 'LIVE'})`);
        const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(q.quest_id)}/`);
        const byStepId = new Map();
        for (const s of (bundle.steps || [])) byStepId.set(s.step_id, s);

        // intro — приходит отдельным полем bundle.intro (не в steps), но с id
        if (q.intro) {
            const dbIntro = bundle.intro && bundle.intro.id
                ? bundle.intro
                : (bundle.steps || []).find(s => s.is_intro || s.step_id === (q.intro.step_id || 'intro'));
            if (dbIntro && dbIntro.id) {
                await apiPatch(`/api/quest-steps/${dbIntro.id}/`, { title: q.intro.title, location: q.intro.location, story: q.intro.story, task: q.intro.task, hint: q.intro.hint || null });
                console.log('  ✅ intro');
            } else {
                console.log('  ⚠️ intro id не найден — пропуск');
            }
        }
        // steps. ВАЖНО: по умолчанию order НЕ трогаем — локальный data-файл может
        // содержать устаревший порядок, а на проде квест уже переупорядочен
        // (см. brest-lantern). Реордер — только по явному --reorder.
        if (doReorder) {
            // двухфазно во избежание коллизий unique(quest, order)
            const present = q.steps.filter(s => byStepId.get(s.step_id));
            for (let i = 0; i < present.length; i++) {
                const db = byStepId.get(present[i].step_id);
                await apiPatch(`/api/quest-steps/${db.id}/`, { order: 900 + i });
            }
        }
        for (const s of q.steps) {
            const db = byStepId.get(s.step_id);
            if (!db) { console.log(`  ⚠️ step ${s.step_id} нет на проде — пропуск (структура не совпадает)`); continue; }
            const finalOrder = doReorder ? q.steps.indexOf(s) + 1 : undefined;
            await apiPatch(`/api/quest-steps/${db.id}/`, stepPayload(s, finalOrder));
            console.log(`  ✅ step ${s.step_id}${doReorder ? ` (order ${finalOrder})` : ''}`);
        }
        // finale — OneToOne с квестом: finale id == numeric quest id (bundle.id).
        // Список финалов скрывает id, но detail /api/quest-finales/<id>/ доступен по id квеста.
        const finaleText = q.finale && (q.finale.text || q.finale.story);
        if (finaleText && bundle.finale && bundle.finale.text !== finaleText) {
            await apiPatch(`/api/quest-finales/${bundle.id}/`, { text: finaleText });
            console.log('  ✅ finale');
        }
    }
    console.log('\n✅ Sync завершён');
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
