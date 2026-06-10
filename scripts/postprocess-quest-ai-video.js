#!/usr/bin/env node
/**
 * Пост-обработка AI-клипа (Qwen/Wan image-to-video) в финальное видео квеста.
 *
 * Вход:  assets/quests/<dir>/ai-raw.mp4 (~5s, без звука)
 * Выход: assets/quests/<dir>/finale.mp4 (клип + стоп-кадр с надписью + музыка)
 *        assets/quests/<dir>/poster.jpg (кадр из AI-клипа)
 *
 * FFMPEG_PATH / MUSIC_DIR — как у generate-quest-finale-videos.js.
 * node scripts/postprocess-quest-ai-video.js --quest-id=prague-old-town
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { QUESTS, ASSETS_DIR } = require('./generate-quest-finale-videos.js');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/i, m => m.replace(/ffmpeg/i, 'ffprobe'));
const MUSIC_DIR = process.env.MUSIC_DIR || 'D:/metravel/tools/music';

const MOODS = {
    castle: 'Ancient Rite.mp3',
    city: 'City Sunshine.mp3',
    epic: 'Inspiration.mp3',
};

const FREEZE = 4.5;      // стоп-кадр с текстом в конце, сек
const FONT_BOLD = 'C\\:/Windows/Fonts/arialbd.ttf';
const FONT_REG = 'C\\:/Windows/Fonts/arial.ttf';

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

function postprocess(q) {
    const dir = path.join(ASSETS_DIR, q.dir);
    const rawPath = path.join(dir, 'ai-raw.mp4');
    if (!fs.existsSync(rawPath)) { console.log(`⚠️  ${q.questId}: нет ${q.dir}/ai-raw.mp4`); return false; }

    const clipDur = probeDuration(rawPath);
    const total = clipDur + FREEZE;
    const textStart = clipDur + 0.3;
    const musicPath = path.join(MUSIC_DIR, MOODS[q.mood]);
    if (!fs.existsSync(musicPath)) throw new Error(`нет музыки: ${musicPath}`);

    const line1 = writeTextFile('Квест пройден!');
    const line2 = writeTextFile(q.city);
    const esc = f => f.replace(/\\/g, '/').replace(/:/g, '\\:');

    const filter = [
        `[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=25,setsar=1,` +
            `tpad=stop_mode=clone:stop_duration=${FREEZE + 0.5},` +
            `drawtext=fontfile='${FONT_BOLD}':textfile='${esc(line1)}':fontsize=64:fontcolor=white:borderw=2:bordercolor=black@0.55:x=(w-text_w)/2:y=h-220:alpha='if(lt(t,${textStart.toFixed(2)}),0,min(1,(t-${textStart.toFixed(2)})/0.8))',` +
            `drawtext=fontfile='${FONT_REG}':textfile='${esc(line2)}':fontsize=40:fontcolor=white:borderw=2:bordercolor=black@0.55:x=(w-text_w)/2:y=h-130:alpha='if(lt(t,${(textStart + 0.4).toFixed(2)}),0,min(1,(t-${(textStart + 0.4).toFixed(2)})/0.8))',` +
            `fade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7[vout]`,
        `[1:a]atrim=0:${total.toFixed(2)},afade=t=in:d=1,afade=t=out:st=${(total - 3).toFixed(2)}:d=3,volume=0.85[aout]`,
    ].join(';');

    const videoPath = path.join(dir, 'finale.mp4');
    run(FFMPEG, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', rawPath,
        '-i', musicPath,
        '-filter_complex', filter,
        '-map', '[vout]', '-map', '[aout]',
        '-t', total.toFixed(2),
        '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart',
        videoPath,
    ], 'finale');

    const posterPath = path.join(dir, 'poster.jpg');
    run(FFMPEG, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-ss', Math.min(3, clipDur - 0.2).toFixed(2), '-i', rawPath,
        '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
        '-frames:v', '1', '-q:v', '3',
        posterPath,
    ], 'poster');

    fs.unlinkSync(line1);
    fs.unlinkSync(line2);
    console.log(`✅ ${q.questId}: finale.mp4 (${sizeMB(videoPath)} MB, ${total.toFixed(1)}s) + poster.jpg (${sizeMB(posterPath)} MB)`);
    return true;
}

const targets = QUESTS.filter(q => !ONLY_QUEST_ID || q.questId === ONLY_QUEST_ID);
if (!targets.length) { console.error(`Unknown quest id: ${ONLY_QUEST_ID}`); process.exit(1); }
let done = 0;
for (const q of targets) { if (postprocess(q)) done++; }
console.log(`\n✅ Обработано: ${done}`);
