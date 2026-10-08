#!/usr/bin/env node
/**
 * Миграция квеста «Город между двух озёр» (Голубая криница) на прод.
 * Идемпотентно: переиспользует существующий квест по quest_id, не дублирует шаги.
 *
 * node scripts/migrate-slavgorod-krinica-quest.js \
 *   --api-url=https://metravel.by
 *
 * Dry run (без записи):
 *   node scripts/migrate-slavgorod-krinica-quest.js --dry-run
 */


const { rethrowTerminalAuthError, createToolSession, TokenError, formatTokenError  } = require('./lib/metravel-tool-session');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by';

function createSession(explicit) {
    return createToolSession({ origin: API_BASE, explicit: explicit || (typeof tokenArg === 'undefined' ? undefined : tokenArg.split('=').slice(1).join('=')) });
}
const SESSION = createSession();



function toBackendDecimal(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return Number(num.toFixed(6)).toString();
}

async function apiPost(endpoint, payload) {
    const headers = { 'Content-Type': 'application/json' };
    if (isDryRun) {
        console.log(`  [DRY] POST ${endpoint}`, JSON.stringify(payload).substring(0, 160));
        return { id: Math.floor(Math.random() * 1000) };
    }
    const response = await SESSION.request(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!response.ok) {
        throw new TokenError('response', { status: response.status });
    }
    return response.json();
}

async function apiGet(endpoint) {
    if (isDryRun) return { data: [] };
    const headers = {};
    const response = await SESSION.request(endpoint, { method: 'GET', headers });
    if (!response.ok) {
        throw new TokenError('response', { status: response.status });
    }
    return response.json();
}

// answer_pattern уже задан явно в данных как {type, value}; backend ждёт строку
function serializeAnswer(step) {
    const ap = step.answer_pattern || { type: 'any', value: '' };
    return JSON.stringify(ap);
}

const QUESTS = require('./slavgorod-krinica-quest-data.js');

async function main() {
    if (!isDryRun) await SESSION.ensureToken();
    console.log(`🚀 Миграция квеста (Голубая криница) → ${API_BASE} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`);

    for (const q of QUESTS) {
        console.log(`\n📋 ${q.quest_id}: "${q.title}"`);

        // 0. Reuse existing quest when present
        let questDbId;
        let existingBundle = null;
        try {
            existingBundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(q.quest_id)}/`);
            questDbId = existingBundle?.id;
            if (questDbId) console.log(`  ℹ️ Quest already exists: id=${questDbId}`);
        } catch (authError) {
          rethrowTerminalAuthError(authError); /* not found — create below */ }

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
              rethrowTerminalAuthError(e);
            process.exitCode = 1;
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
              rethrowTerminalAuthError(e);
            process.exitCode = 1;
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
              rethrowTerminalAuthError(e);
            process.exitCode = 1;
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
              rethrowTerminalAuthError(e);
            process.exitCode = 1;
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
              rethrowTerminalAuthError(e);
            process.exitCode = 1;
                console.error(`  ❌ Finale: ${e.message}`);
            }
        }

        console.log(`\n🎉 Квест "${q.title}" готов!`);
        console.log(`   URL: https://metravel.by/quests/x/${q.quest_id}`);
    }

    console.log('\n✅ Миграция завершена');
}

main().catch(err => { console.error('Fatal:', formatTokenError(err)); process.exit(1); });
