#!/usr/bin/env node
/**
 * Пост-обработка AI-клипа (Qwen/Wan image-to-video) в финальное видео квеста.
 *
 * Вход:  assets/quests/<dir>/ai-raw.mp4 (~5s, без звука)
 * Выход: assets/quests/<dir>/finale.mp4 (клип + стоп-кадр с надписью, немой)
 *        assets/quests/<dir>/poster.jpg (кадр из AI-клипа)
 *
 * Профиль ролика (H.264/yuv420p, CRF 28, faststart, без аудио, ≤1280 px,
 * ≤30 c, ≤2.5 Мбит/с, ≤8 MiB) берётся из quest-finale-video-profile.js —
 * это фронтовое отражение backend-документа docs/QUEST_FINALE_VIDEO_POLICY.md.
 *
 * FFMPEG_PATH — как у generate-quest-finale-videos.js.
 * node scripts/postprocess-quest-ai-video.js --quest-id=prague-old-town
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const {
    QUESTS,
    ASSETS_DIR,
    FPS,
    FONT_BOLD,
    FONT_REG,
    hasDrawtext,
    renderTextOverlayPng,
} = require('./generate-quest-finale-videos.js');
const { LIMITS, videoEncodeArgs, assertFileCompliant } = require('./quest-finale-video-profile.js');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/i, m => m.replace(/ffmpeg/i, 'ffprobe'));

const FREEZE = 4.5;      // стоп-кадр с текстом в конце, сек

const args = process.argv.slice(2);
const questIdArg = args.find(a => a.startsWith('--quest-id='));
const ONLY_QUEST_ID = questIdArg ? questIdArg.split('=')[1] : null;

function run(bin, cmdArgs, label) {
    const r = spawnSync(bin, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${path.basename(bin)} failed (${label}): ${(r.stderr || '').slice(-800)}`);
    return r.stdout;
}

function probeDuration(file) {
    const out = run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 'probe');
    return parseFloat(out.trim());
}

function writeTextFile(text) {
    const f = path.join(os.tmpdir(), `qp-${Math.random().toString(36).slice(2)}.txt`);
    fs.writeFileSync(f, text, 'utf8');
    return f;
}

function sizeMB(f) { return (fs.statSync(f).size / 1048576).toFixed(2); }

const BASE_CHAIN = `scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=${FPS},setsar=1`;

// ffmpeg без libfreetype (нет drawtext) — текст рендерим в PNG и накладываем overlay-ом.
function renderVideoOverlay(rawPath, outPath, cityLabel, total, textStart) {
    const overlayPng = renderTextOverlayPng(cityLabel);
    const filter = [
        `[0:v]${BASE_CHAIN},tpad=stop_mode=clone:stop_duration=${FREEZE + 0.5}[base]`,
        `[1:v]format=rgba,fade=t=in:st=${textStart.toFixed(2)}:d=0.8:alpha=1[txt]`,
        `[base][txt]overlay=0:0:format=auto,fade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7[vout]`,
    ].join(';');

    run(FFMPEG, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', rawPath,
        '-loop', '1', '-framerate', String(FPS), '-t', total.toFixed(2), '-i', overlayPng,
        '-filter_complex', filter,
        '-map', '[vout]',
        '-t', total.toFixed(2),
        ...videoEncodeArgs(),
        outPath,
    ], 'finale');

    fs.unlinkSync(overlayPng);
}

function renderVideoDrawtext(rawPath, outPath, cityLabel, total, textStart) {
    const line1 = writeTextFile('Квест пройден!');
    const line2 = writeTextFile(cityLabel);
    const esc = f => f.replace(/\\/g, '/').replace(/:/g, '\\:');

    const filter = `[0:v]${BASE_CHAIN},` +
        `tpad=stop_mode=clone:stop_duration=${FREEZE + 0.5},` +
        `drawtext=fontfile='${FONT_BOLD}':textfile='${esc(line1)}':fontsize=64:fontcolor=white:borderw=2:bordercolor=black@0.55:x=(w-text_w)/2:y=h-220:alpha='if(lt(t,${textStart.toFixed(2)}),0,min(1,(t-${textStart.toFixed(2)})/0.8))',` +
        `drawtext=fontfile='${FONT_REG}':textfile='${esc(line2)}':fontsize=40:fontcolor=white:borderw=2:bordercolor=black@0.55:x=(w-text_w)/2:y=h-130:alpha='if(lt(t,${(textStart + 0.4).toFixed(2)}),0,min(1,(t-${(textStart + 0.4).toFixed(2)})/0.8))',` +
        `fade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7[vout]`;

    run(FFMPEG, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', rawPath,
        '-filter_complex', filter,
        '-map', '[vout]',
        '-t', total.toFixed(2),
        ...videoEncodeArgs(),
        outPath,
    ], 'finale');

    fs.unlinkSync(line1);
    fs.unlinkSync(line2);
}

function postprocess(q) {
    const dir = path.join(ASSETS_DIR, q.dir);
    const rawPath = path.join(dir, 'ai-raw.mp4');
    if (!fs.existsSync(rawPath)) { console.log(`⚠️  ${q.questId}: нет ${q.dir}/ai-raw.mp4`); return false; }

    const clipDur = probeDuration(rawPath);
    const total = clipDur + FREEZE;
    if (total > LIMITS.maxDurationSeconds) {
        throw new Error(`${q.questId}: ai-raw.mp4 ${clipDur.toFixed(1)}s + ${FREEZE}s стоп-кадра выходит за лимит ${LIMITS.maxDurationSeconds}s`);
    }
    const textStart = clipDur + 0.3;

    const videoPath = path.join(dir, 'finale.mp4');
    if (hasDrawtext()) renderVideoDrawtext(rawPath, videoPath, q.city, total, textStart);
    else renderVideoOverlay(rawPath, videoPath, q.city, total, textStart);
    const video = assertFileCompliant(videoPath);

    const posterPath = path.join(dir, 'poster.jpg');
    run(FFMPEG, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-ss', Math.min(3, clipDur - 0.2).toFixed(2), '-i', rawPath,
        '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
        '-frames:v', '1', '-q:v', '3',
        posterPath,
    ], 'poster');

    console.log(`✅ ${q.questId}: finale.mp4 (${sizeMB(videoPath)} MB, ${video.durationSeconds.toFixed(1)}s, ${Math.round(video.bitrateBps / 1000)} kbps) + poster.jpg (${sizeMB(posterPath)} MB)`);
    return true;
}

const targets = QUESTS.filter(q => !ONLY_QUEST_ID || q.questId === ONLY_QUEST_ID);
if (!targets.length) { console.error(`Unknown quest id: ${ONLY_QUEST_ID}`); process.exit(1); }
let done = 0;
for (const q of targets) { if (postprocess(q)) done++; }
console.log(`\n✅ Обработано: ${done}`);
