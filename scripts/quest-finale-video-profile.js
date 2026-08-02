#!/usr/bin/env node
/**
 * Единый фронтовый профиль финальных видео квестов.
 *
 * Источник правды — backend-документ `docs/QUEST_FINALE_VIDEO_POLICY.md`
 * (задача #1169): MP4 c H.264 (`avc1`/`avc3`), без аудиодорожки, `moov` до
 * `mdat` (+faststart), максимум 1280 px по длинной стороне, не длиннее 30 с,
 * средний битрейт до 2.5 Мбит/с и файл до 8 MiB; целевое кодирование —
 * libx264 / yuv420p / CRF 28.
 *
 * Второй набор лимитов на фронте заводить нельзя: любые правки — только вслед
 * за backend-документом, и все генераторы берут значения отсюда.
 *
 * Проверка — байтовый порт backend-валидатора `quests/video_policy.py`
 * (`inspect_quest_finale_mp4` + `_policy_violations`), чтобы локальный прогон
 * давал те же `policy_violations`, что и команда `audit_quest_finale_videos`.
 *
 * CLI: node scripts/quest-finale-video-profile.js <file.mp4> [...]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LIMITS = Object.freeze({
    maxBytes: 8 * 1024 * 1024,
    maxDurationSeconds: 30,
    maxDimension: 1280,
    maxBitrateBps: 2_500_000,
});

const TARGET = Object.freeze({
    crf: 28,
    preset: 'medium',
    pixelFormat: 'yuv420p',
});

const H264_SAMPLE_ENTRIES = ['avc1', 'avc3'];

/** Аргументы ffmpeg для финального видео: H.264/yuv420p, CRF 28, faststart, без звука. */
function videoEncodeArgs() {
    return [
        '-an',
        '-c:v', 'libx264',
        '-crf', String(TARGET.crf),
        '-preset', TARGET.preset,
        '-pix_fmt', TARGET.pixelFormat,
        '-movflags', '+faststart',
    ];
}

function* iterBoxes(buf) {
    let offset = 0;
    while (offset + 8 <= buf.length) {
        let size = buf.readUInt32BE(offset);
        const boxType = buf.toString('latin1', offset + 4, offset + 8);
        let headerSize = 8;
        if (size === 1) {
            if (offset + 16 > buf.length) throw new Error('MP4: обрезанный box');
            const high = buf.readUInt32BE(offset + 8);
            const low = buf.readUInt32BE(offset + 12);
            size = high * 2 ** 32 + low;
            headerSize = 16;
        } else if (size === 0) {
            size = buf.length - offset;
        }
        if (size < headerSize || offset + size > buf.length) throw new Error('MP4: некорректный размер box');
        yield { type: boxType, start: offset, end: offset + size };
        offset += size;
    }
    if (offset !== buf.length) throw new Error('MP4: хвостовые байты вне boxes');
}

function mp4DurationSeconds(moov) {
    const offset = moov.indexOf('mvhd', 0, 'latin1');
    if (offset < 4 || offset + 24 > moov.length) throw new Error('MP4: нет метаданных длительности');
    const boxSize = moov.readUInt32BE(offset - 4);
    if (boxSize < 28 || offset - 4 + boxSize > moov.length) throw new Error('MP4: битые метаданные длительности');
    const version = moov[offset + 4];
    let timescale;
    let duration;
    if (version === 0) {
        timescale = moov.readUInt32BE(offset + 16);
        duration = moov.readUInt32BE(offset + 20);
    } else if (version === 1) {
        if (offset + 36 > moov.length) throw new Error('MP4: битые метаданные длительности');
        timescale = moov.readUInt32BE(offset + 24);
        duration = Number(moov.readBigUInt64BE(offset + 28));
    } else {
        throw new Error('MP4: битые метаданные длительности');
    }
    if (timescale <= 0 || duration <= 0) throw new Error('MP4: битые метаданные длительности');
    return duration / timescale;
}

/** Байтовый разбор MP4 по правилам backend-валидатора. */
function inspectMp4(buf) {
    const boxes = [...iterBoxes(buf)];
    if (buf.length < 32 || !boxes.some(box => box.type === 'ftyp')) {
        throw new Error('MP4: невалидный контейнер');
    }
    const moovBox = boxes.find(box => box.type === 'moov');
    const mdatBox = boxes.find(box => box.type === 'mdat');
    if (!moovBox || !mdatBox) throw new Error('MP4: нет обязательных boxes moov/mdat');

    const moov = buf.subarray(moovBox.start, moovBox.end);
    const codec = H264_SAMPLE_ENTRIES.find(marker => moov.includes(marker, 0, 'latin1'));
    if (!codec) throw new Error('MP4: кодек не H.264');

    const codecOffset = moov.indexOf(codec, 0, 'latin1');
    const sampleStart = codecOffset - 4;
    const sampleSize = sampleStart >= 0 ? moov.readUInt32BE(sampleStart) : 0;
    if (sampleStart < 0 || sampleSize < 36 || sampleStart + sampleSize > moov.length) {
        throw new Error('MP4: битый H.264 sample entry');
    }
    const width = moov.readUInt16BE(codecOffset + 28);
    const height = moov.readUInt16BE(codecOffset + 30);
    if (width <= 0 || height <= 0) throw new Error('MP4: нет размеров кадра');

    const durationSeconds = mp4DurationSeconds(moov);
    return {
        codec,
        width,
        height,
        durationSeconds,
        bitrateBps: Math.round((buf.length * 8) / durationSeconds),
        hasAudio: moov.includes('soun', 0, 'latin1'),
        faststart: moovBox.start < mdatBox.start,
        sizeBytes: buf.length,
    };
}

/** Ключи нарушений совпадают с `_policy_violations` бэкенда. */
function policyViolations(metadata) {
    const violations = [];
    if (metadata.sizeBytes > LIMITS.maxBytes) violations.push('max_bytes');
    if (Math.max(metadata.width, metadata.height) > LIMITS.maxDimension) violations.push('max_dimension');
    if (metadata.durationSeconds > LIMITS.maxDurationSeconds) violations.push('max_duration_seconds');
    if (metadata.bitrateBps > LIMITS.maxBitrateBps) violations.push('max_bitrate_bps');
    if (metadata.hasAudio) violations.push('audio_track');
    if (!metadata.faststart) violations.push('faststart');
    return violations;
}

function inspectFile(filePath) {
    const metadata = inspectMp4(fs.readFileSync(filePath));
    return { ...metadata, policyViolations: policyViolations(metadata) };
}

/** Бросает ошибку, если файл не примет backend-валидатор. */
function assertFileCompliant(filePath) {
    const report = inspectFile(filePath);
    if (report.policyViolations.length) {
        throw new Error(`${path.basename(filePath)} нарушает quest finale video policy: ${report.policyViolations.join(', ')}`);
    }
    return report;
}

function auditRow(filePath) {
    const row = { file: filePath };
    try {
        const report = inspectFile(filePath);
        Object.assign(row, {
            size_bytes: report.sizeBytes,
            codec: report.codec,
            width: report.width,
            height: report.height,
            duration_seconds: Number(report.durationSeconds.toFixed(3)),
            bitrate_bps: report.bitrateBps,
            has_audio: report.hasAudio,
            faststart: report.faststart,
            policy_violations: report.policyViolations,
        });
    } catch (e) {
        row.error = e.message;
    }
    return row;
}

function main(files) {
    if (!files.length) {
        console.error('Usage: node scripts/quest-finale-video-profile.js <file.mp4> [...]');
        process.exit(2);
    }
    const summary = { processed: 0, compliant: 0, non_compliant: 0, errors: 0, total_bytes: 0 };
    for (const file of files) {
        const row = auditRow(file);
        console.log(JSON.stringify(row));
        summary.processed += 1;
        summary.total_bytes += row.size_bytes || 0;
        if (row.error) summary.errors += 1;
        else if (row.policy_violations.length) summary.non_compliant += 1;
        else summary.compliant += 1;
    }
    console.log(JSON.stringify({ summary }));
    process.exit(summary.compliant === summary.processed ? 0 : 1);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
    LIMITS,
    TARGET,
    videoEncodeArgs,
    inspectMp4,
    policyViolations,
    inspectFile,
    assertFileCompliant,
    auditRow,
};
