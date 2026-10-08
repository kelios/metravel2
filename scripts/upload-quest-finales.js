#!/usr/bin/env node
/**
 * Заливка финальных видео и постеров квестов на прод.
 *
 *   PATCH /api/quest-finales/{finaleId}/ → video (file) + poster (file)
 *
 * Токен: env METRAVEL_TOKEN, иначе .secrets/metravel-token.json ({"token": "..."}).
 * Протухший токен → 401 Invalid token; свежий: node scripts/get-quest-token.js.
 * Маппинг finaleId —
 * в scripts/generate-quest-finale-videos.js (сверен с прода по тексту финала).
 *
 * node scripts/upload-quest-finales.js [--dry-run] [--quest-id=...] [--posters-only]
 *   --posters-only — залить только постеры (включая 5 старых квестов с готовым видео)
 */

const { rethrowTerminalAuthError, createToolSession, TokenError, formatTokenError  } = require('./lib/metravel-tool-session');
const fs = require('fs');
const path = require('path');
const { QUESTS, EXISTING_VIDEO_QUESTS, ASSETS_DIR } = require('./generate-quest-finale-videos.js');

const API_BASE = process.env.QUEST_API_BASE || 'https://metravel.by';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const postersOnly = args.includes('--posters-only');
const videoOnly = args.includes('--video-only');
const questIdArg = args.find(a => a.startsWith('--quest-id='));
const ONLY_QUEST_ID = questIdArg ? questIdArg.split('=')[1] : null;

const SESSION = createToolSession({ origin: API_BASE, order: ['env', 'json'] });

function sizeMB(f) { return (fs.statSync(f).size / 1048576).toFixed(2); }

async function patchFinale(finaleId, files, session = SESSION) {
    const form = new FormData();
    for (const [field, filePath] of Object.entries(files)) {
        const mime = filePath.endsWith('.mp4') ? 'video/mp4' : filePath.endsWith('.png') ? 'image/png' : filePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        form.append(field, new File([fs.readFileSync(filePath)], path.basename(filePath), { type: mime }));
    }
    const r = await session.request(`/api/quest-finales/${finaleId}/`, {
        method: 'PATCH',
        body: form,
    });
    if (!r.ok) throw new TokenError('response', { status: r.status });
    return r.json();
}

async function verifyFinale(questId) {
    const r = await fetch(`${API_BASE}/api/quests/by-quest-id/${questId}/`);
    if (!r.ok) return null;
    const b = await r.json();
    return b.finale || null;
}

async function main() {
    console.log(`🚀 Upload quest finales → ${API_BASE} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`);

    const targets = postersOnly
        ? [...QUESTS, ...EXISTING_VIDEO_QUESTS]
        : QUESTS;

    for (const q of targets) {
        if (ONLY_QUEST_ID && q.questId !== ONLY_QUEST_ID) continue;
        const dir = path.join(ASSETS_DIR, q.dir);
        const videoPath = path.join(dir, 'finale.mp4');
        const posterPath = path.join(dir, 'poster.jpg');

        const files = {};
        if (!postersOnly && fs.existsSync(videoPath)) files.video = videoPath;
        if (!videoOnly && fs.existsSync(posterPath)) files.poster = posterPath;

        if (!Object.keys(files).length) {
            console.log(`⚠️  ${q.questId}: нет файлов в ${q.dir}/`);
            continue;
        }

        const desc = Object.entries(files).map(([f, p]) => `${f} ${sizeMB(p)} MB`).join(', ');
        if (isDryRun) {
            console.log(`[DRY] ${q.questId}: ${desc} → PATCH /api/quest-finales/${q.finaleId}/`);
            continue;
        }

        try {
            await patchFinale(q.finaleId, files);
            const finale = await verifyFinale(q.questId);
            const ok = (!files.video || !!(finale && finale.video_url)) && (!files.poster || !!(finale && finale.poster_url));
            console.log(`${ok ? '✅' : '❌'} ${q.questId}: ${desc}${ok ? '' : ' — finale не обновился!'}`);
        } catch (e) {
          rethrowTerminalAuthError(e);
            console.error(`❌ ${q.questId}: ${formatTokenError(e)}`);
        }
    }

    console.log('\n✅ Done');
}

if (require.main === module) main().catch(e => { console.error('Fatal:', formatTokenError(e)); process.exit(1); });
module.exports = { patchFinale, verifyFinale, main };
