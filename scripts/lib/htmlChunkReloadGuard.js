#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  CHUNK_RELOAD_SCRIPT_ID,
  getChunkReloadBootstrapScript,
} = require('../../utils/chunkReloadGuard');

const verifiedBootstrapBodies = new Set();

// Metro can minify the self-contained factory before SSR calls toString().
// Validate that variant against the recovery contract, inside bounded VM runs.
function assertBootstrapBehavior(body) {
  if (body === getChunkReloadBootstrapScript() || verifiedBootstrapBodies.has(body)) return;
  const script = new vm.Script(body);
  const storage = new Map();
  let now = 1700000000000;
  function loadDocument(storageFailure) {
    let reloads = 0;
    let listener;
    const win = {
      location: { href: 'https://metravel.by/travels/test', origin: 'https://metravel.by', reload: () => { reloads += 1; } },
      sessionStorage: {
        getItem: (key) => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => { storage.set(key, String(value)); },
      },
      addEventListener: (name, callback, capture) => {
        if (name !== 'error' || capture !== true || typeof callback !== 'function' || listener) {
          throw new Error('expected one capturing resource-error listener');
        }
        listener = callback;
      },
    };
    if (storageFailure === 'getter') {
      Object.defineProperty(win, 'sessionStorage', {
        configurable: true,
        get: () => { throw new Error('storage unavailable'); },
      });
    } else if (storageFailure === 'read') {
      win.sessionStorage.getItem = () => { throw new Error('storage unavailable'); };
    } else if (storageFailure) {
      win.sessionStorage.setItem = () => {
        if (storageFailure === 'write') throw new Error('storage unavailable');
      };
    }
    const context = vm.createContext({ window: win, URL, Date: { now: () => now } });
    script.runInContext(context, { timeout: 100 });
    if (!listener || reloads !== 0 || typeof win.__metravelReloadStaleChunk !== 'function') {
      throw new Error('bootstrap must install recovery without reloading eagerly');
    }
    if (storageFailure) {
      // Reproduce the shell's later replacement with a nonpersistent shim.
      const shim = new Map();
      Object.defineProperty(win, 'sessionStorage', {
        value: { getItem: (key) => shim.get(key) ?? null, setItem: (key, value) => shim.set(key, value) },
        configurable: true,
      });
    }
    return {
      reloads: () => reloads,
      dispatch: (src) => {
        context.__onError = listener;
        context.__event = { target: { tagName: 'SCRIPT', src } };
        new vm.Script('__onError(__event)').runInContext(context, { timeout: 100 });
      },
    };
  }
  const first = loadDocument();
  first.dispatch('https://elsewhere.example/_expo/static/js/web/entry-missing.js');
  first.dispatch('https://metravel.by/unrelated.js');
  if (first.reloads() !== 0 || storage.size !== 0) throw new Error('unrelated scripts must not trigger recovery');
  first.dispatch('https://metravel.by/_expo/static/js/web/entry-missing.js');
  if (first.reloads() !== 1 || storage.get('mt:chunk-reload-ts') !== String(now)) {
    throw new Error('missing entry must reload once and persist the shared timestamp');
  }
  first.dispatch('https://metravel.by/_expo/static/js/web/common-missing.js');
  if (first.reloads() !== 1) throw new Error('repeated missing chunks must not trigger another reload');
  const next = loadDocument();
  next.dispatch('https://metravel.by/_expo/static/js/web/entry-missing.js');
  if (next.reloads() !== 0) throw new Error('a new document must honor the persisted reload guard');
  now += 29999;
  const withinWindow = loadDocument();
  withinWindow.dispatch('https://metravel.by/_expo/static/js/web/entry-missing.js');
  if (withinWindow.reloads() !== 0) throw new Error('reload guard must last the full 30 seconds');
  now += 1;
  first.dispatch('https://metravel.by/_expo/static/js/web/entry-missing.js');
  if (first.reloads() !== 1) throw new Error('one document must never reload twice, even after 30 seconds');
  const expired = loadDocument();
  expired.dispatch('https://metravel.by/_expo/static/js/web/entry-missing.js');
  if (expired.reloads() !== 1) throw new Error('a later document must recover after 30 seconds');
  for (const failure of ['getter', 'read', 'write', 'discard']) {
    storage.clear();
    const blocked = loadDocument(failure);
    blocked.dispatch('https://metravel.by/_expo/static/js/web/entry-missing.js');
    if (blocked.reloads() !== 0) throw new Error(`unavailable storage (${failure}) must prevent reload`);
  }
  verifiedBootstrapBodies.add(body);
}

// Scan generated HTML without mistaking quoted attributes, comments or raw-text
// contents for scripts. Template descendants are inert until instantiated.
function readHtmlTags(html) {
  const tags = [];
  const token = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  const rawText = /^(script|style|textarea|title|xmp|iframe|noembed|noscript)$/i;
  let templateDepth = 0;
  let match;
  while ((match = token.exec(html))) {
    if (!match[1]) continue;
    const name = match[1].toLowerCase();
    const closing = match[0].startsWith('</');
    if (closing) {
      if (name === 'template') templateDepth = Math.max(0, templateDepth - 1);
      continue;
    }
    const attrs = Object.create(null);
    const attribute = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let attr;
    while ((attr = attribute.exec(match[2]))) {
      const key = attr[1].toLowerCase();
      // Browsers retain the first occurrence of a duplicated attribute.
      if (!(key in attrs)) attrs[key] = attr[2] ?? attr[3] ?? attr[4] ?? '';
    }
    const tag = { name, attrs, start: match.index, end: token.lastIndex, body: '', inert: templateDepth > 0 };
    if (rawText.test(name)) {
      const close = new RegExp(`</${name}\\s*>`, 'gi');
      close.lastIndex = token.lastIndex;
      const end = close.exec(html);
      tag.body = html.slice(token.lastIndex, end ? end.index : html.length);
      token.lastIndex = end ? close.lastIndex : html.length;
    }
    tags.push(tag);
    if (name === 'template') templateDepth += 1;
  }
  return tags;
}

function assertHtmlChunkReloadGuard(html, label = 'HTML') {
  const tags = readHtmlTags(html);
  const guards = tags.filter((tag) => tag.attrs.id === CHUNK_RELOAD_SCRIPT_ID);
  const fail = (reason) => { throw new Error(`${label}: chunk reload guard ${reason}`); };
  if (guards.length !== 1) fail(`must occur exactly once (found ${guards.length})`);
  const guard = guards[0];
  if (guard.name !== 'script' || guard.inert || 'src' in guard.attrs) {
    fail('must be an active inline script without src');
  }
  if ('nomodule' in guard.attrs || ('type' in guard.attrs && guard.attrs.type !== 'text/javascript')) {
    fail('must execute synchronously as classic JavaScript');
  }
  try {
    assertBootstrapBehavior(guard.body);
  } catch (error) {
    fail(`inline content violates the shared bootstrap contract: ${error.message}`);
  }
  const firstExternal = tags.find((tag) => tag.name === 'script' && !tag.inert && 'src' in tag.attrs);
  if (firstExternal && guard.start > firstExternal.start) fail('must precede the first external script');
}

function ensureHtmlChunkReloadGuard(html, label = 'HTML') {
  const tags = readHtmlTags(html);
  if (tags.some((tag) => tag.attrs.id === CHUNK_RELOAD_SCRIPT_ID)) {
    assertHtmlChunkReloadGuard(html, label);
    return html;
  }
  const head = tags.find((tag) => tag.name === 'head' && !tag.inert);
  if (!head) throw new Error(`${label}: cannot inject chunk reload guard without a head element`);
  const script = `<script id="${CHUNK_RELOAD_SCRIPT_ID}">${getChunkReloadBootstrapScript()}</script>`;
  const result = html.slice(0, head.end) + script + html.slice(head.end);
  assertHtmlChunkReloadGuard(result, label);
  return result;
}

function listHtmlFiles(distDir) {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (entry.isFile() && /\.html$/i.test(entry.name)) files.push(filePath);
    }
  }
  visit(distDir);
  if (files.length === 0) throw new Error(`${distDir}: no HTML files to check for chunk reload guard`);
  return files;
}

function assertHtmlChunkReloadGuards(distDir) {
  const files = listHtmlFiles(distDir);
  for (const filePath of files) assertHtmlChunkReloadGuard(fs.readFileSync(filePath, 'utf8'), filePath);
  return { checked: files.length };
}

function ensureHtmlChunkReloadGuards(distDir) {
  const files = listHtmlFiles(distDir);
  let injected = 0;
  for (const filePath of files) {
    const html = fs.readFileSync(filePath, 'utf8');
    const guarded = ensureHtmlChunkReloadGuard(html, filePath);
    if (guarded !== html) {
      fs.writeFileSync(filePath, guarded, 'utf8');
      injected += 1;
    }
  }
  return { ...assertHtmlChunkReloadGuards(distDir), injected };
}

module.exports = {
  assertHtmlChunkReloadGuard,
  assertHtmlChunkReloadGuards,
  ensureHtmlChunkReloadGuard,
  ensureHtmlChunkReloadGuards,
};

if (require.main === module) {
  try {
    if (process.argv.length !== 3 || process.argv[2].startsWith('-')) {
      throw new Error('Usage: node scripts/lib/htmlChunkReloadGuard.js <dist>');
    }
    const { checked } = assertHtmlChunkReloadGuards(path.resolve(process.argv[2]));
    console.log(`[html-chunk-reload-guard] Checked ${checked} HTML files`);
  } catch (error) {
    console.error(`[html-chunk-reload-guard] ${error.message}`);
    process.exitCode = 1;
  }
}
