#!/usr/bin/env node
/**
 * Миграция квеста «Белорусская Одесса» (Бобруйск) на прод.
 * Идемпотентно: переиспользует существующий квест по quest_id, не дублирует шаги.
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/migrate-bobruisk-quest.js \
 *   --api-url=https://metravel.by --token=YOUR_TOKEN
 *
 * Dry run (без записи):
 *   node scripts/migrate-bobruisk-quest.js --dry-run
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

if (!TOKEN && !isDryRun) {
    console.error('❌ Нужен токен: --token=YOUR_TOKEN, либо env METRAVEL_TOKEN, либо ~/.metravel_token');
    process.exit(1);
}

function toBackendDecimal(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return Number(num.toFixed(6)).toString();
}

async function apiPost(endpoint, payload) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    if (isDryRun) {
        console.log(`  [DRY] POST ${endpoint}`, JSON.stringify(payload).substring(0, 160));
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

// answer_pattern уже задан явно в данных как {type, value}; backend ждёт строку
function serializeAnswer(step) {
    const ap = step.answer_pattern || { type: 'any', value: '' };
    return JSON.stringify(ap);
}

const QUESTS = require('./bobruisk-quest-data.js');

async function main() {
    console.log(`🚀 Миграция квеста (Бобруйск) → ${API_BASE} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`);

    for (const q of QUESTS) {
        console.log(`\n📋 ${q.quest_id}: "${q.title}"`);

        // 0. Reuse existing quest when present
        let questDbId;
        let existingBundle = null;
        try {
            existingBundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(q.quest_id)}/`);
            questDbId = existingBundle?.id;
            if (questDbId) console.log(`  ℹ️ Quest already exists: id=${questDbId}`);
        } catch { /* not found — create below */ }

        // 1. Create city (only when quest is missing)
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
                console.log(`  ✅ City: id=${cityId} (${q.city.name})`);
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
                    tags: q.meta.tags.reduce((a, t) => { a[t] = true; return a; }, {}),
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
                ? existingBundle.steps.map(s => s?.step_id).filter(Boolean)
                : []
        );

        // 3. Intro step
        const hasIntro = Array.isArray(existingBundle?.steps)
            ? existingBundle.steps.some(s => s?.is_intro === true || s?.step_id === 'intro')
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
                    answer_pattern: serializeAnswer(q.intro),
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

        // 4. Regular steps
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
                    answer_pattern: serializeAnswer(s),
                    lat: toBackendDecimal(s.lat),
                    lng: toBackendDecimal(s.lng),
                    maps_url: s.mapsUrl,
                    input_type: s.inputType || (s.answer_pattern && (s.answer_pattern.type === 'range' || s.answer_pattern.type === 'exact' || s.answer_pattern.type === 'any_number') ? 'number' : 'text'),
                    order: i + 1,
                    is_intro: false,
                });
                console.log(`  ✅ Step ${i + 1}/${q.steps.length}: ${s.step_id} — ${s.title}`);
            } catch (e) {
                console.error(`  ❌ Step ${s.step_id}: ${e.message}`);
            }
        }

        // 5. Finale
        if (existingBundle?.finale?.text) {
            console.log('  ℹ️ Finale already exists, skip');
        } else {
            try {
                await apiPost('/api/quest-finales/', { quest: questDbId, text: q.finale.text });
                console.log(`  ✅ Finale`);
            } catch (e) {
                console.error(`  ❌ Finale: ${e.message}`);
            }
        }

        console.log(`\n🎉 Квест "${q.title}" готов!`);
        console.log(`   URL: https://metravel.by/quests/bobruisk/${q.quest_id}`);
    }

    console.log('\n✅ Миграция завершена');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
