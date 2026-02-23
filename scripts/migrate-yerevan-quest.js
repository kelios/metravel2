#!/usr/bin/env node
/**
 * Миграция квеста «Ереван: Город на вулкане» на прод.
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/migrate-yerevan-quest.js \
 *   --api-url=https://metravel.by --token=YOUR_TOKEN
 *
 * Dry run (без записи):
 *   node scripts/migrate-yerevan-quest.js --dry-run
 */

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by';
const TOKEN = tokenArg ? tokenArg.split('=').slice(1).join('=') : null;

if (!TOKEN && !isDryRun) {
    console.error('❌ Нужен токен: --token=YOUR_TOKEN');
    console.error('   Получи токен через Django admin → /admin/ → Auth Token');
    process.exit(1);
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

function serializeAnswer(answerFn) {
    const f = answerFn.toString();
    if (f.includes('() => true') || (f.includes('=> true') && !f.includes('=>'))) {
        return JSON.stringify({ type: 'any', value: '' });
    }
    // any (arrow with body returning true)
    if (/=>\s*true/.test(f) && !f.includes('parseInt') && !f.includes('includes') && !f.includes('length')) {
        return JSON.stringify({ type: 'any', value: '' });
    }
    // range: n >= X && n <= Y
    const rng = f.match(/n\s*>=\s*(\d+)\s*&&\s*n\s*<=\s*(\d+)/);
    if (rng) return JSON.stringify({ type: 'range', value: JSON.stringify({ min: +rng[1], max: +rng[2] }) });
    // exact number
    const intE = f.match(/parseInt\(s,\s*10\)\s*===\s*(\d+)/);
    if (intE) return JSON.stringify({ type: 'exact', value: intE[1] });
    // any_number
    if (f.includes('!Number.isNaN(parseInt')) return JSON.stringify({ type: 'any_number', value: '' });
    // any_text with min_length
    const len = f.match(/\.length\s*>\s*(\d+)/);
    if (len) return JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: +len[1] + 1 }) });
    // any_text (s.trim().length > 2 etc)
    if (f.includes('.length')) return JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 3 }) });
    // exact_any via includes array
    const ie = f.match(/\[([^\]]+)\]\.some\(/);
    if (ie) return JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 2 }) });
    // fallback: any_text
    console.warn('⚠️  Cannot serialize answer fn, using any_text:', f.substring(0, 80));
    return JSON.stringify({ type: 'any_text', value: JSON.stringify({ min_length: 2 }) });
}

const QUESTS = require('./yerevan-quest-data.js');

async function main() {
    console.log(`🚀 Миграция квеста «Ереван» → ${API_BASE} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`);

    for (const q of QUESTS) {
        console.log(`\n📋 ${q.quest_id}: "${q.title}"`);

        // 1. Create city
        let cityId;
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

        // 2. Create quest
        let questDbId;
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

        // 3. Create intro step
        if (q.intro) {
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
                    lat: String(q.intro.lat || 0),
                    lng: String(q.intro.lng || 0),
                    maps_url: q.intro.mapsUrl || 'https://maps.google.com/?q=Yerevan',
                    input_type: 'text',
                    order: 0,
                    is_intro: true,
                });
                console.log(`  ✅ Intro step`);
            } catch (e) {
                console.error(`  ❌ Intro: ${e.message}`);
            }
        }

        // 4. Create regular steps
        for (let i = 0; i < q.steps.length; i++) {
            const s = q.steps[i];
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
                    lat: String(s.lat),
                    lng: String(s.lng),
                    maps_url: s.mapsUrl,
                    input_type: s.inputType || 'text',
                    order: i + 1,
                    is_intro: false,
                });
                console.log(`  ✅ Step ${i + 1}/${q.steps.length}: ${s.step_id} — ${s.title}`);
            } catch (e) {
                console.error(`  ❌ Step ${s.step_id}: ${e.message}`);
            }
        }

        // 5. Create finale
        try {
            await apiPost('/api/quest-finales/', {
                quest: questDbId,
                text: q.finale.text,
            });
            console.log(`  ✅ Finale`);
        } catch (e) {
            console.error(`  ❌ Finale: ${e.message}`);
        }

        console.log(`\n🎉 Квест "${q.title}" создан!`);
        console.log(`   URL: https://metravel.by/quests/yerevan/${q.quest_id}`);
    }

    console.log('\n✅ Миграция завершена');
    console.log('\nСледующий шаг: загрузи обложку через Django admin:');
    console.log('  https://metravel.by/admin/quests/quest/');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
