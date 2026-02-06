#!/usr/bin/env node
/**
 * Загрузка медиа-файлов квестов на прод через multipart PATCH.
 *
 * Эндпоинты:
 *   PATCH /api/quests/{id}/        → cover_image (file)
 *   PATCH /api/quest-steps/{id}/   → image (file)
 *   PATCH /api/quest-finales/{id}/ → video (file)
 *
 * NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/upload-quest-media-prod.js \
 *   --api-url=https://metravel.by --token=YOUR_TOKEN
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const apiUrlArg = args.find(a => a.startsWith('--api-url='));
const tokenArg = args.find(a => a.startsWith('--token='));
const API_BASE = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by';
const TOKEN = tokenArg ? tokenArg.split('=').slice(1).join('=') : null;

const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'quests');

function getMime(f) {
    const ext = path.extname(f).toLowerCase();
    return { '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
}

function sizeMB(f) { try { return (fs.statSync(f).size / 1048576).toFixed(2); } catch { return '?'; } }

async function upload(endpoint, fieldName, filePath) {
    const buf = fs.readFileSync(filePath);
    const form = new FormData();
    form.append(fieldName, new File([buf], path.basename(filePath), { type: getMime(filePath) }));
    const headers = {};
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    const r = await fetch(`${API_BASE}${endpoint}`, { method: 'PATCH', headers, body: form });
    if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.substring(0, 200)}`); }
    return r.json();
}

async function fetchBundle(questId) {
    const headers = {};
    if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`;
    const r = await fetch(`${API_BASE}/api/quests/by-quest-id/${questId}/`, { headers });
    if (!r.ok) throw new Error(`Fetch ${questId}: HTTP ${r.status}`);
    return r.json();
}

const QUEST_MEDIA = [
    {
        quest_id: 'krakow-dragon', assetsDir: 'krakowDragon', cover: 'cover.png',
        stepImages: { '1-rynek': '1.png', '2-mariacki': '2.png', '3-sukiennice': '3.png', '4-barbakan': '4.png', '5-kazimierz': '5.png', '6-wawel': '6.png', '7-smocza-jama': '7.png' },
        finaleVideo: 'krakowDragon.mp4',
    },
    {
        quest_id: 'pakocim-voices', assetsDir: 'pakocim', cover: 'cover.png',
        stepImages: { '1-herb': '1.png', '2-palace': '1.png', '3-pond': '1.png', '4-oak': '1.png', '5-hedgehog': '1.png', '6-birdhouses': '1.png', '7-slona-woda': '1.png', '8-fort': '1.png', '9-bridge': '1.png', 'bonus-cafe': '1.png' },
        finaleVideo: 'prokocim.mp4',
    },
    {
        quest_id: 'barkovshchina-spirits', assetsDir: 'barkovshchina', cover: 'cover.png',
        stepImages: { 'point-1': '1.png', 'point-1-2': '1.png', 'point-2': '1.png', 'point-2-2': '1.png', 'point-3': '1.png', 'point-3-2': '1.png' },
        finaleVideo: 'forest.mp4',
    },
    {
        quest_id: 'minsk-cmok', assetsDir: 'minskDragon', cover: 'cover.png',
        stepImages: { '1-forest-memory': '1.png', '2-sun-memory': '1.png', '3-star-memory': '1.png', '4-voice-memory': '1.png', '5-memory-memory': '1.png', '6-word-memory': '1.png', '7-water-memory': '1.png' },
        finaleVideo: 'minskDragon.mp4',
    },
];

async function main() {
    console.log(`🚀 Upload quest media → ${API_BASE} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`);

    for (const qm of QUEST_MEDIA) {
        const dir = path.join(ASSETS_DIR, qm.assetsDir);
        console.log(`\n📋 ${qm.quest_id}`);

        // Fetch bundle to get DB IDs
        let bundle;
        try {
            bundle = await fetchBundle(qm.quest_id);
        } catch (e) {
            console.error(`  ❌ Cannot fetch bundle: ${e.message}`);
            continue;
        }

        const questDbId = bundle.id;
        const steps = bundle.steps || [];
        const finale = bundle.finale;

        // 1. Upload cover
        const coverPath = path.join(dir, qm.cover);
        if (fs.existsSync(coverPath)) {
            if (isDryRun) {
                console.log(`  [DRY] cover: ${qm.cover} (${sizeMB(coverPath)} MB) → PATCH /api/quests/${questDbId}/`);
            } else {
                try {
                    await upload(`/api/quests/${questDbId}/`, 'cover_image', coverPath);
                    console.log(`  ✅ cover (${sizeMB(coverPath)} MB)`);
                } catch (e) {
                    console.error(`  ❌ cover: ${e.message}`);
                }
            }
        }

        // 2. Upload step images
        // Build step_id → DB step id mapping
        const stepIdMap = {};
        for (const s of steps) {
            stepIdMap[s.step_id] = s.id;
        }

        // Track already-uploaded files to avoid re-uploading same file to same step
        const uploadedToSteps = new Set();
        for (const [stepId, imgFile] of Object.entries(qm.stepImages)) {
            const imgPath = path.join(dir, imgFile);
            const dbStepId = stepIdMap[stepId];
            if (!dbStepId) {
                console.log(`  ⚠️  step ${stepId}: not found in DB`);
                continue;
            }
            if (!fs.existsSync(imgPath)) {
                console.log(`  ⚠️  step ${stepId}: file ${imgFile} not found`);
                continue;
            }

            const key = `${dbStepId}-${imgFile}`;
            if (uploadedToSteps.has(key)) continue;
            uploadedToSteps.add(key);

            if (isDryRun) {
                console.log(`  [DRY] step ${stepId}: ${imgFile} (${sizeMB(imgPath)} MB) → PATCH /api/quest-steps/${dbStepId}/`);
            } else {
                try {
                    await upload(`/api/quest-steps/${dbStepId}/`, 'image', imgPath);
                    console.log(`  ✅ step ${stepId} image (${sizeMB(imgPath)} MB)`);
                } catch (e) {
                    console.error(`  ❌ step ${stepId}: ${e.message}`);
                }
            }
        }

        // 3. Upload finale video
        if (qm.finaleVideo && finale) {
            const videoPath = path.join(dir, qm.finaleVideo);
            const finaleDbId = finale.id;
            if (fs.existsSync(videoPath) && finaleDbId) {
                if (isDryRun) {
                    console.log(`  [DRY] video: ${qm.finaleVideo} (${sizeMB(videoPath)} MB) → PATCH /api/quest-finales/${finaleDbId}/`);
                } else {
                    try {
                        await upload(`/api/quest-finales/${finaleDbId}/`, 'video', videoPath);
                        console.log(`  ✅ video (${sizeMB(videoPath)} MB)`);
                    } catch (e) {
                        console.error(`  ❌ video: ${e.message}`);
                    }
                }
            }
        }
    }

    console.log('\n✅ Done');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
