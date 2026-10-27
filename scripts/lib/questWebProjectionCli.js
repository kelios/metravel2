'use strict';

const fs = require('node:fs');
const { projectQuestWeb } = require('./questWebProjection');

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const WINDOW_BYTES = 1024 * 1024;
const WHITESPACE = new Set([0x20, 0x0a, 0x0d, 0x09]);
const invalid = () => new Error('Invalid quest snapshot JSON');

// A regular-file stdin (the backend refresher) is read by position, so the raw
// snapshot is never resident; a stream falls back to one buffer.
function fileSource(fd, size) {
  return { size, read(start, end) {
    const bytes = Buffer.allocUnsafe(end - start);
    for (let offset = 0; offset < bytes.length;) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, start + offset);
      if (!count) throw invalid();
      offset += count;
    }
    return bytes;
  } };
}

async function readSource(input) {
  if (input === process.stdin) {
    const info = fs.fstatSync(0);
    if (info.isFile()) {
      if (info.size > MAX_INPUT_BYTES) throw new Error('Quest snapshot exceeds the input byte limit');
      return fileSource(0, info.size);
    }
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_INPUT_BYTES) throw new Error('Quest snapshot exceeds the input byte limit');
    chunks.push(bytes);
  }
  const buffer = Buffer.concat(chunks);
  return { size: buffer.length, read: (start, end) => buffer.subarray(start, end) };
}

function byteReader(source) {
  let base = 0, window = Buffer.alloc(0);
  return (position) => {
    if (position < base || position >= base + window.length) {
      if (position < 0 || position >= source.size) return undefined;
      base = position;
      window = source.read(position, Math.min(source.size, position + WINDOW_BYTES));
    }
    return window[position - base];
  };
}

function skipWhitespace(at, position) {
  while (WHITESPACE.has(at(position))) position += 1;
  return position;
}

function skipString(at, position) {
  for (position += 1; ; position += 1) {
    const byte = at(position);
    if (byte === undefined) throw invalid();
    if (byte === 0x5c) position += 1;
    else if (byte === 0x22) return position + 1;
  }
}

// Structural bounds only; every member that is used is validated by JSON.parse.
function skipValue(at, position) {
  const first = at(position);
  if (first === 0x22) return skipString(at, position);
  if (first === 0x7b || first === 0x5b) {
    for (let depth = 0; ; position += 1) {
      const byte = at(position);
      if (byte === undefined) throw invalid();
      if (byte === 0x22) position = skipString(at, position) - 1;
      else if (byte === 0x7b || byte === 0x5b) depth += 1;
      else if ((byte === 0x7d || byte === 0x5d) && --depth === 0) return position + 1;
    }
  }
  const start = position;
  for (let byte = at(position); byte !== undefined && byte !== 0x2c && byte !== 0x7d && byte !== 0x5d
    && !WHITESPACE.has(byte); byte = at(position)) position += 1;
  if (position === start) throw invalid();
  return position;
}

/** Byte ranges of an object's direct members; a repeated key keeps its last (valid) value, as JSON.parse does. */
function objectMembers(source, at, start) {
  let position = skipWhitespace(at, start);
  if (at(position) !== 0x7b) throw invalid();
  const members = new Map();
  position = skipWhitespace(at, position + 1);
  if (at(position) === 0x7d) return { members, end: position + 1 };
  for (;;) {
    if (at(position) !== 0x22) throw invalid();
    const keyEnd = skipString(at, position);
    const key = JSON.parse(source.read(position, keyEnd).toString('utf8'));
    position = skipWhitespace(at, keyEnd);
    if (at(position) !== 0x3a) throw invalid();
    const valueStart = skipWhitespace(at, position + 1);
    const valueEnd = skipValue(at, valueStart);
    // JSON.parse would have validated the value a repeated key replaces.
    if (members.has(key)) JSON.parse(source.read(...members.get(key)).toString('utf8'));
    members.set(key, [valueStart, valueEnd]);
    position = skipWhitespace(at, valueEnd);
    if (at(position) === 0x7d) return { members, end: position + 1 };
    if (at(position) !== 0x2c) throw invalid();
    position = skipWhitespace(at, position + 1);
  }
}

function indexSnapshot(source) {
  const at = byteReader(source);
  const parse = ([start, end]) => JSON.parse(source.read(start, end).toString('utf8'));
  const top = objectMembers(source, at, 0);
  if (skipWhitespace(at, top.end) !== source.size) throw invalid();
  const header = {};
  for (const [key, range] of top.members) {
    if (key !== 'bundles') Object.defineProperty(header, key, { value: parse(range), enumerable: true, writable: true, configurable: true });
  }
  const bundles = top.members.has('bundles') ? objectMembers(source, at, top.members.get('bundles')[0]).members : new Map();
  for (const [locale, range] of bundles) {
    if (!['ru', 'be', 'uk', 'pl', 'en'].includes(locale)) parse(range);
  }
  return { header, bundles: (locale) => (bundles.has(locale) ? parse(bundles.get(locale)) : undefined) };
}

async function runProjectionCli(catalogs, { input = process.stdin, output = process.stdout, error = process.stderr } = {}) {
  try {
    const source = indexSnapshot(await readSource(input));
    let written = 0, first = true;
    const write = (text) => {
      written += Buffer.byteLength(text);
      if (written > MAX_OUTPUT_BYTES) throw new Error('Quest projection exceeds the output byte limit');
      output.write(text);
    };
    // Byte-identical to JSON.stringify({ schema_version, pages, discovery }), one page at a time.
    write('{"schema_version":2,"pages":[');
    const discovery = projectQuestWeb(source, catalogs, (page) => {
      write((first ? '' : ',') + JSON.stringify(page));
      first = false;
    });
    write(`],"discovery":${JSON.stringify(discovery)}}`);
    output.write('\n');
    return true;
  } catch {
    // Do not echo a malformed private snapshot or JSON parser excerpts.
    error.write('Quest public projection rejected the private snapshot\n');
    process.exitCode = 1;
    return false;
  }
}

module.exports = { runProjectionCli, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES };
