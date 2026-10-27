'use strict';

const { buildQuestWebProjection } = require('./questWebProjection');

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

async function runProjectionCli(catalogs, { input = process.stdin, output = process.stdout, error = process.stderr } = {}) {
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of input) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_INPUT_BYTES) throw new Error('Quest snapshot exceeds the input byte limit');
      chunks.push(bytes);
    }
    const snapshot = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result = JSON.stringify(buildQuestWebProjection(snapshot, catalogs));
    if (Buffer.byteLength(result) > MAX_OUTPUT_BYTES) throw new Error('Quest projection exceeds the output byte limit');
    output.write(result + '\n');
    return true;
  } catch {
    // Do not echo a malformed private snapshot or JSON parser excerpts.
    error.write('Quest public projection rejected the private snapshot\n');
    process.exitCode = 1;
    return false;
  }
}

module.exports = { runProjectionCli, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES };
