/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils';

const {
  CHUNK_RELOAD_SCRIPT_ID,
  getChunkReloadBootstrapScript,
} = require('@/utils/chunkReloadGuard');
const {
  assertHtmlChunkReloadGuard,
  assertHtmlChunkReloadGuards,
  ensureHtmlChunkReloadGuard,
  ensureHtmlChunkReloadGuards,
} = require('@/scripts/lib/htmlChunkReloadGuard');
const { buildRedirectStubHtml, patchNoindexFallbackTemplate } = require('@/scripts/generate-seo-pages');

describe('HTML chunk reload build guard', () => {
  let distDir: string;
  const external = '<script src="/_expo/static/js/web/entry-hash.js" defer></script>';
  const guard = () => `<script id="${CHUNK_RELOAD_SCRIPT_ID}">${getChunkReloadBootstrapScript()}</script>`;
  const shell = (head = guard() + external) => `<!doctype html><html><head>${head}</head><body></body></html>`;
  const write = (relativePath: string, html: string) => {
    const file = path.join(distDir, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html, 'utf8');
    return file;
  };

  beforeEach(() => {
    distDir = makeTempDir('html-chunk-guard-');
  });

  afterEach(() => {
    removeDir(distDir);
  });

  it('checks every nested HTML variant, including fallback templates and redirects', () => {
    write('index.html', shell());
    write('travels/slug.html', shell());
    write('travels/slug/index.html', shell());
    const fallback = patchNoindexFallbackTemplate(shell(), {
      title: 'Missing', description: 'Missing route',
    });
    write('travels/[param].html', fallback);
    const redirect = buildRedirectStubHtml('new-slug');
    const redirectFile = write('travels/old-slug/index.html', redirect);

    expect(ensureHtmlChunkReloadGuards(distDir)).toEqual({ checked: 5, injected: 1 });
    const result = fs.readFileSync(redirectFile, 'utf8');
    expect(result.indexOf(guard())).toBeLessThan(result.indexOf('location.replace('));
    expect(assertHtmlChunkReloadGuards(distDir)).toEqual({ checked: 5 });
    expect(ensureHtmlChunkReloadGuards(distDir)).toEqual({ checked: 5, injected: 0 });
  });

  it.each<[string, () => string, RegExp]>([
    ['missing', () => external, /exactly once \(found 0\)/],
    ['late', () => external + guard(), /precede the first external script/],
    ['tampered', () => guard().replace('</script>', ';window.__metravelReloadStaleChunk=function(){};</script>') + external, /violates the shared bootstrap contract/],
    ['duplicate', () => guard() + guard() + external, /exactly once \(found 2\)/],
    ['external guard', () => guard().replace('<script ', '<script src="guard.js" ') + external, /without src/],
    ['non-executable guard', () => guard().replace('<script ', '<script type="application/json" ') + external, /classic JavaScript/],
    ['module guard', () => guard().replace('<script ', '<script type="module" ') + external, /classic JavaScript/],
    ['nomodule guard', () => guard().replace('<script ', '<script nomodule ') + external, /classic JavaScript/],
    ['inert guard', () => `<template>${guard()}</template>${external}`, /active inline script/],
  ])('rejects a %s guard even when index.html is valid', (_name, content, error) => {
    write('index.html', shell());
    write('quests/city/quest/index.html', shell(content()));
    expect(() => assertHtmlChunkReloadGuards(distDir)).toThrow(error);
    expect(() => assertHtmlChunkReloadGuards(distDir)).toThrow('quests/city/quest/index.html');
  });

  it('injects the exact shared bootstrap as the first head content and is idempotent', () => {
    const input = shell('<script>window.storageShim=true;</script>' + external);
    const result = ensureHtmlChunkReloadGuard(input);
    expect(result).toContain(`<head>${guard()}<script>window.storageShim=true;</script>`);
    expect(ensureHtmlChunkReloadGuard(result)).toBe(result);
    expect(() => assertHtmlChunkReloadGuard(result)).not.toThrow();
  });

  it('does not conceal or overwrite an existing invalid guard', () => {
    const input = shell(guard().replace('</script>', ';window.__metravelReloadStaleChunk=function(){};</script>'));
    const file = write('index.html', input);
    expect(() => ensureHtmlChunkReloadGuards(distDir)).toThrow(/violates the shared bootstrap contract/);
    expect(fs.readFileSync(file, 'utf8')).toBe(input);
  });

  it('accepts an equivalent SSR factory variant after its recovery behavior is verified', () => {
    const variant = guard().replace('function createChunkReloadGuard', 'function a');
    expect(variant).not.toBe(guard());
    write('index.html', shell(variant + external));
    write('travels/slug/index.html', shell(variant + external));
    expect(assertHtmlChunkReloadGuards(distDir)).toEqual({ checked: 2 });
  });

  it.each([1, 30001])('rejects an SSR variant with a %sms fuse', (windowMs) => {
    const variant = guard().replace(',30000)', `,${windowMs})`);
    expect(variant).not.toBe(guard());
    expect(() => assertHtmlChunkReloadGuard(shell(variant + external))).toThrow(/30 seconds/);
  });

  it('rejects an SSR variant that trusts silently discarded storage writes', () => {
    const variant = guard().replace('if (storage.getItem(key) !== String(now)) return false;', '');
    expect(variant).not.toBe(guard());
    expect(() => assertHtmlChunkReloadGuard(shell(variant + external))).toThrow(/unavailable storage \(discard\)/);
  });

  it.each([
    'while(true){}',
    'window.location.reload();',
    "window.__metravelReloadStaleChunk=function(){};window.addEventListener('error',function(){window.location.reload()},true);",
  ])('rejects invalid or unbounded bootstrap code: %s', (body) => {
    const input = shell(`<script id="${CHUNK_RELOAD_SCRIPT_ID}">${body}</script>`);
    expect(() => assertHtmlChunkReloadGuard(input)).toThrow(/violates the shared bootstrap contract/);
  });

  it('does not mistake comments, quoted attributes or script bodies for guard elements', () => {
    const comment = `<!--${guard()}-->`;
    expect(() => assertHtmlChunkReloadGuard(shell(comment + external))).toThrow(/found 0/);
    const quoted = `<meta content='${guard().replace(/'/g, '&#39;')}'>`;
    expect(() => assertHtmlChunkReloadGuard(shell(quoted + external))).toThrow(/found 0/);
    const source = `<script>var marker = '<script id="${CHUNK_RELOAD_SCRIPT_ID}">';</script>`;
    expect(() => assertHtmlChunkReloadGuard(shell(source + external))).toThrow(/found 0/);
  });

  it('does not mistake data-src or a script in a template for an earlier external script', () => {
    const before = '<script data-src="example.js"></script><template><script src="inert.js"></script></template>';
    expect(() => assertHtmlChunkReloadGuard(shell(before + guard() + external))).not.toThrow();
  });

  it('fails closed for missing head and empty output', () => {
    expect(() => ensureHtmlChunkReloadGuard('<html><body>Stub</body></html>')).toThrow(/without a head/);
    expect(() => assertHtmlChunkReloadGuards(distDir)).toThrow(/no HTML files/);
    expect(() => ensureHtmlChunkReloadGuards(distDir)).toThrow(/no HTML files/);
  });

  it('CLI checks the real artifact and returns nonzero for an invalid nested page', () => {
    write('index.html', shell());
    const cli = path.resolve('scripts/lib/htmlChunkReloadGuard.js');
    const valid = runNodeCli([cli, distDir]);
    expect(valid.status).toBe(0);
    expect(valid.stdout).toContain('Checked 1 HTML files');
    write('travels/old/index.html', shell(external));
    const invalid = runNodeCli([cli, distDir]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('travels/old/index.html');
    expect(runNodeCli([cli]).status).toBe(1);
  });
});
