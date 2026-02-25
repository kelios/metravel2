#!/usr/bin/env node
/**
 * Миграция квестов на прод через CRUD-эндпоинты.
 * Использует данные из migrate-quests-to-backend.js
 *
 * Порядок: cities → quests → steps (включая intro) → finales
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/migrate-quests-to-prod.js \
 *   --api-url=https://metravel.by --token=YOUR_TOKEN
 */

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by';
const TOKEN = tokenArg ? tokenArg.split('=').slice(1).join('=') : null;

function toBackendDecimal(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    // Keep precision but satisfy DecimalField(max_digits=10)
    return Number(num.toFixed(6)).toString();
}

async function apiPost(endpoint, payload) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    if (isDryRun) {
        console.log(`  [DRY] POST ${endpoint}`, JSON.stringify(payload).substring(0, 200));
        return { id: Math.floor(Math.random() * 1000) };
    }
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} POST ${endpoint}: ${text}`);
    }
    return response.json();
}

async function apiGet(endpoint) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {};
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} GET ${endpoint}: ${text}`);
    }
    return response.json();
}

function serializeAnswer(answerFn) {
    const f = answerFn.toString();
    if (f.includes('=> true') || f.includes('() => true')) return JSON.stringify({ type: 'any', value: '' });
    const ie = f.match(/\[([^\]]+)\]\.includes\((?:normalize\(s\)|s)\)/);
    if (ie) { const v = ie[1].replace(/'/g, '').split(',').map(x => x.trim()); return JSON.stringify({ type: 'exact_any', value: JSON.stringify(v) }); }
    const intE = f.match(/parseInt\(s,\s*10\)\s*===\s*(\d+)/);
    if (intE) return JSON.stringify({ type: 'exact', value: intE[1] });
    const rng = f.match(/n\s*>=\s*(\d+)\s*&&\s*n\s*<=\s*(\d+)/);
    if (rng) return JSON.stringify({ type: 'range', value: JSON.stringify({ min: +rng[1], max: +rng[2] }) });
    const intRng = f.match(/Number\.isInteger\(n\)\s*&&\s*n\s*>=\s*(\d+)\s*&&\s*n\s*<=\s*(\d+)/);
    if (intRng) return JSON.stringify({ type: 'range', value: JSON.stringify({ min: +intRng[1], max: +intRng[2] }) });
    if (f.includes('!Number.isNaN(parseInt')) return JSON.stringify({ type: 'any_number', value: '' });
    const approx = f.match(/Math\.abs\(parseFloat.*?-\s*([\d.]+)\)\s*<\s*([\d.]+)/);
    if (approx) return JSON.stringify({ type: 'approx', value: JSON.stringify({ target: +approx[1], tolerance: +approx[2] }) });
    const exact = f.match(/(?:normalize\(s\)|s)\s*===\s*'([^']+)'/);
    if (exact) return JSON.stringify({ type: 'exact', value: exact[1] });
    const trim = f.match(/\.trim\(\)\s*===\s*'([^']+)'/);
    if (trim) return JSON.stringify({ type: 'exact', value: trim[1] });
    if (f.includes('s.trim().length>0') || f.includes('s.trim().length > 0')) return JSON.stringify({ type: 'any', value: '' });
    const len = f.match(/(?:normalize\(s\)|s)\.length\s*>\s*(\d+)/);
    if (len) return JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: +len[1] + 1 }) });
    const slen = f.match(/s\.length\s*>\s*(\d+)/);
    if (slen) return JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: +slen[1] + 1 }) });
    console.warn('⚠️  Cannot serialize:', f.substring(0, 80));
    return JSON.stringify({ type: 'function', value: f });
}

// Import quest data from the existing migration script
// We re-require the data inline to avoid duplication
const QUESTS = require('./migrate-quests-to-backend-data.js');

async function main() {
    console.log(`🚀 Миграция квестов → ${API_BASE} (${isDryRun ? 'DRY RUN' : 'LIVE'})`);

    for (const q of QUESTS) {
        console.log(`\n📋 ${q.quest_id}: "${q.title}"`);

        // 0. Reuse existing quest when present
        let questDbId;
        let existingBundle = null;
        try {
            existingBundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(q.quest_id)}/`);
            questDbId = existingBundle?.id;
            if (questDbId) {
                console.log(`  ℹ️ Quest already exists: id=${questDbId}`);
            }
        } catch {
            // Not found or temporary error — we try create flow below.
        }

        // 1. Create city (only when quest does not exist)
        let cityId;
        if (!questDbId) {
            try {
                const city = await apiPost('/api/quest-cities/', {
                    name: q.city.name,
                    country: q.city.country,
                    lat: String(q.city.lat),
                    lng: String(q.city.lng),
                    status: 1,
                });
                cityId = city.id;
                console.log(`  ✅ City: id=${cityId}`);
            } catch (e) {
                console.error(`  ❌ City: ${e.message}`);
                continue;
            }
        }

        // 2. Create quest (if missing)
        if (!questDbId) {
            try {
                const quest = await apiPost('/api/quests/', {
                    quest_id: q.quest_id,
                    title: q.title,
                    city: cityId,
                    lat: String(q.meta.lat),
                    lng: String(q.meta.lng),
                    duration_min: q.meta.duration_min,
                    difficulty: q.meta.difficulty,
                    tags: q.meta.tags ? q.meta.tags.reduce((a, t) => { a[t] = true; return a; }, {}) : {},
                    pet_friendly: q.meta.pet_friendly,
                    storage_key: q.storage_key,
                    status: 1,
                });
                questDbId = quest.id;
                console.log(`  ✅ Quest: id=${questDbId}`);
            } catch (e) {
                console.error(`  ❌ Quest: ${e.message}`);
                continue;
            }
        }

        const existingStepIds = new Set(
            Array.isArray(existingBundle?.steps)
                ? existingBundle.steps.map((s) => s?.step_id).filter(Boolean)
                : []
        );

        // 3. Create intro step
        const hasIntro = Array.isArray(existingBundle?.steps)
            ? existingBundle.steps.some((s) => s?.is_intro === true || s?.step_id === 'intro')
            : false;
        if (q.intro && !hasIntro) {
            try {
                await apiPost('/api/quest-steps/', {
                    quest: questDbId,
                    step_id: q.intro.step_id || 'intro',
                    title: q.intro.title,
                    location: q.intro.location,
                    story: q.intro.story,
                    task: q.intro.task,
                    hint: q.intro.hint || null,
                    answer_pattern: serializeAnswer(q.intro.answer),
                    lat: toBackendDecimal(q.intro.lat || 0),
                    lng: toBackendDecimal(q.intro.lng || 0),
                    maps_url: q.intro.mapsUrl || `https://metravel.by/quests/${encodeURIComponent(q.quest_id)}`,
                    input_type: 'text',
                    order: 0,
                    is_intro: true,
                });
                console.log(`  ✅ Intro step`);
            } catch (e) {
                console.error(`  ❌ Intro: ${e.message}`);
            }
        } else if (q.intro && hasIntro) {
            console.log('  ℹ️ Intro already exists, skip');
        }

        // 4. Create regular steps
        for (let i = 0; i < q.steps.length; i++) {
            const s = q.steps[i];
            if (existingStepIds.has(s.step_id)) {
                console.log(`  ℹ️ Step ${s.step_id} already exists, skip`);
                continue;
            }
            try {
                await apiPost('/api/quest-steps/', {
                    quest: questDbId,
                    step_id: s.step_id,
                    title: s.title,
                    location: s.location,
                    story: s.story,
                    task: s.task,
                    hint: s.hint || null,
                    answer_pattern: serializeAnswer(s.answer),
                    lat: toBackendDecimal(s.lat),
                    lng: toBackendDecimal(s.lng),
                    maps_url: s.mapsUrl,
                    input_type: s.inputType || 'text',
                    order: i + 1,
                    is_intro: false,
                });
                console.log(`  ✅ Step ${i + 1}/${q.steps.length}: ${s.step_id}`);
            } catch (e) {
                console.error(`  ❌ Step ${s.step_id}: ${e.message}`);
            }
        }

        // 5. Create finale
        if (existingBundle?.finale?.text) {
            console.log('  ℹ️ Finale already exists, skip');
        } else {
            try {
                await apiPost('/api/quest-finales/', {
                    quest: questDbId,
                    text: q.finale.text,
                });
                console.log(`  ✅ Finale`);
            } catch (e) {
                console.error(`  ❌ Finale: ${e.message}`);
            }
        }
    }

    console.log('\n✅ Миграция завершена');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
