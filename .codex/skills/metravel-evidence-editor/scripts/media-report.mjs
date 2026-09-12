#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const [input] = process.argv.slice(2);
if (!input) {
  console.error('Usage: media-report.mjs <media-file>');
  process.exit(2);
}

const fileStat = await stat(input, { bigint: true });
if (!fileStat.isFile()) throw new Error(`Not a file: ${input}`);

const probe = spawnSync(
  'ffprobe',
  [
    '-v', 'error',
    '-show_entries',
    'format=duration,size,format_name:stream=index,codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,channels,sample_rate',
    '-of', 'json',
    input,
  ],
  { encoding: 'utf8' },
);

if (probe.error) throw probe.error;
if (probe.status !== 0) {
  console.error(probe.stderr.trim() || `ffprobe exited ${probe.status}`);
  process.exit(probe.status || 1);
}

const sha256 = await new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(input);
  stream.on('error', reject);
  stream.on('data', chunk => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const finalStat = await stat(input, { bigint: true });
const sourceChanged =
  finalStat.dev !== fileStat.dev ||
  finalStat.ino !== fileStat.ino ||
  finalStat.size !== fileStat.size ||
  finalStat.mtimeNs !== fileStat.mtimeNs ||
  finalStat.ctimeNs !== fileStat.ctimeNs;
if (sourceChanged) {
  throw new Error(`Source changed while reporting: ${input}`);
}

const metadata = JSON.parse(probe.stdout);
const format = metadata.format ?? {};
const report = {
  input,
  sha256,
  bytes: Number(format.size ?? fileStat.size),
  duration_seconds: Number(format.duration),
  format: format.format_name ?? null,
  streams: metadata.streams ?? [],
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
