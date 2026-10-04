#!/usr/bin/env node
// Verifies an App Review scene manifest against the final video file:
// required scene coverage from ../scenes.json, monotonic timecodes inside the
// probed duration, SHA-256 of the video, H.264/yuv420p profile and the audio
// declaration, and proof of every App Review guideline sub-point in the
// catalog. It does not certify privacy: that needs continuous playback.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const [manifestPath] = process.argv.slice(2);
if (!manifestPath) {
  console.error('Usage: scene-manifest-check.mjs <manifest.json>');
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(await readFile(path.join(here, '..', 'scenes.json'), 'utf8'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const manifestDir = path.dirname(path.resolve(manifestPath));
const failures = [];
const out = (line) => process.stdout.write(`${line}\n`);
const fail = (message) => failures.push(message);

for (const key of ['version', 'build', 'sourceCommit', 'device', 'osVersion', 'recordedAtISO']) {
  if (typeof manifest[key] !== 'string' || !manifest[key].trim()) fail(`manifest.${key} must be a non-empty string`);
}
if (manifest.recordedAtISO && Number.isNaN(Date.parse(manifest.recordedAtISO))) fail('manifest.recordedAtISO is not an ISO date');
if (manifest.sourceCommit && !/^[0-9a-f]{7,40}$/i.test(manifest.sourceCommit)) fail('manifest.sourceCommit must be a git SHA');

const video = manifest.video ?? {};
if (typeof video.path !== 'string') fail('manifest.video.path is required');
const videoPath = typeof video.path === 'string' ? path.resolve(manifestDir, video.path) : null;

const parseTimecode = (value) => {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}(\.\d+)?$/.test(p))) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
};

let duration = null;
let streams = [];
if (videoPath) {
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,codec_type,pix_fmt', '-of', 'json', videoPath],
    { encoding: 'utf8' },
  );
  if (probe.error || probe.status !== 0) {
    fail(`ffprobe failed for ${video.path}: ${probe.error?.message ?? probe.stderr.trim()}`);
  } else {
    const parsed = JSON.parse(probe.stdout);
    duration = Number(parsed.format?.duration);
    streams = parsed.streams ?? [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    if (!videoStream) fail('no video stream');
    else {
      if (videoStream.codec_name !== 'h264') fail(`video codec is ${videoStream.codec_name}, expected h264`);
      if (!['yuv420p', 'yuvj420p'].includes(videoStream.pix_fmt)) fail(`pixel format is ${videoStream.pix_fmt}, expected yuv420p or yuvj420p`);
    }
    const hasAudio = streams.some((s) => s.codec_type === 'audio');
    if (hasAudio !== Boolean(video.audio)) fail(`audio stream present=${hasAudio} but manifest.video.audio=${Boolean(video.audio)}`);
    const sha256 = await new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(videoPath);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
    if (typeof video.sha256 !== 'string') fail('manifest.video.sha256 is required');
    else if (video.sha256.toLowerCase() !== sha256) fail(`video sha256 mismatch: manifest ${video.sha256}, file ${sha256}`);
  }
}

const scenarios = Array.isArray(manifest.scenarios) ? manifest.scenarios : [];
const notApplicable = Array.isArray(manifest.notApplicable) ? manifest.notApplicable : [];
const known = new Set(catalog.scenes.map((s) => s.id));
const byId = new Map();
let previous = -1;
for (const scene of scenarios) {
  if (!known.has(scene.id)) fail(`unknown scene id "${scene.id}"`);
  if (byId.has(scene.id)) fail(`duplicate scene id "${scene.id}"`);
  byId.set(scene.id, scene);
  if (!['pass', 'fail'].includes(scene.result)) fail(`scene ${scene.id}: result must be pass|fail`);
  const seconds = parseTimecode(scene.videoTimecode);
  if (seconds === null) fail(`scene ${scene.id}: videoTimecode "${scene.videoTimecode}" is not mm:ss or hh:mm:ss`);
  else {
    if (duration !== null && seconds > duration) fail(`scene ${scene.id}: timecode ${scene.videoTimecode} exceeds duration ${duration.toFixed(2)}s`);
    if (seconds < previous) fail(`scene ${scene.id}: timecode ${scene.videoTimecode} is earlier than the previous scene`);
    previous = Math.max(previous, seconds);
  }
}
const naById = new Map();
for (const item of notApplicable) {
  if (!known.has(item.id)) fail(`notApplicable: unknown scene id "${item.id}"`);
  if (!item.reason || !item.evidence) fail(`notApplicable ${item.id}: reason and evidence are required`);
  if (byId.has(item.id)) fail(`scene ${item.id} is both recorded and notApplicable`);
  naById.set(item.id, item);
}

const rows = [];
let missing = 0;
for (const scene of catalog.scenes) {
  const recorded = byId.get(scene.id);
  const na = naById.get(scene.id);
  let status;
  if (recorded) status = `${recorded.result} @ ${recorded.videoTimecode}`;
  else if (na) status = `n/a (${na.reason})`;
  else status = scene.required ? 'MISSING' : 'not recorded';
  if (scene.required && (!recorded || recorded.result !== 'pass') && !na) missing += 1;
  rows.push(`${scene.required ? '*' : ' '} ${scene.id.padEnd(24)} ${status}`);
}
if (missing > 0) fail(`${missing} required scene(s) without pass or notApplicable`);

// Guideline sub-points (#2136): each one is proven on this exact build by its
// passing scenes and, where the catalog asks, an attestation for what a video
// cannot show. A scene marked notApplicable never proves a sub-point.
const guidelines = Array.isArray(catalog.guidelines) ? catalog.guidelines : [];
const guidelineById = new Map();
for (const guideline of guidelines) {
  if (guidelineById.has(guideline.id)) fail(`catalog: duplicate guideline "${guideline.id}"`);
  guidelineById.set(guideline.id, guideline);
  for (const id of guideline.scenes ?? []) {
    if (!known.has(id)) fail(`catalog: guideline ${guideline.id} references unknown scene "${id}"`);
  }
  if (!(guideline.scenes ?? []).length && !guideline.attestation) fail(`catalog: guideline ${guideline.id} has no evidence source`);
}
const attestations = Array.isArray(manifest.attestations) ? manifest.attestations : [];
const attestationById = new Map();
for (const item of attestations) {
  const problems = [];
  const guideline = guidelineById.get(item.id);
  if (!guideline) problems.push(`attestation: unknown guideline "${item.id}"`);
  else if (!guideline.attestation) problems.push(`attestation ${item.id}: the catalog does not ask for one`);
  if (attestationById.has(item.id)) problems.push(`attestation ${item.id}: duplicate`);
  if (typeof item.evidence !== 'string' || !item.evidence.trim()) problems.push(`attestation ${item.id}: evidence is required`);
  if (item.build !== manifest.build) problems.push(`attestation ${item.id}: build "${item.build}" is not the candidate build "${manifest.build}"`);
  problems.forEach(fail);
  // An invalid attestation never proves its sub-point.
  if (!problems.length) attestationById.set(item.id, item);
}
const guidelineRows = [];
for (const guideline of guidelines) {
  const gaps = (guideline.scenes ?? []).filter((id) => byId.get(id)?.result !== 'pass').map((id) => `scene ${id}`);
  if (guideline.attestation && !attestationById.has(guideline.id)) gaps.push('attestation');
  if (gaps.length) fail(`guideline ${guideline.id} not proven on build ${manifest.build ?? '?'}: missing ${gaps.join(', ')}`);
  guidelineRows.push(`${guideline.id.padEnd(9)} ${gaps.length ? `MISSING ${gaps.join(', ')}` : 'proven'}`);
}

out(`candidate ${manifest.version ?? '?'} (${manifest.build ?? '?'}) source ${manifest.sourceCommit ?? '?'} on ${manifest.device ?? '?'} ${manifest.osVersion ?? '?'}`);
out(`video ${video.path ?? '?'} duration ${duration === null ? '?' : `${duration.toFixed(2)}s`} audio ${streams.some((s) => s.codec_type === 'audio')}`);
out(rows.join('\n'));
if (guidelineRows.length) out(`guidelines\n${guidelineRows.join('\n')}`);
if (failures.length) {
  out(`FAIL (${failures.length})`);
  for (const message of failures) out(`- ${message}`);
  process.exit(1);
}
out('PASS: coverage, file integrity and guideline sub-points verified; privacy playback review is a separate step');
