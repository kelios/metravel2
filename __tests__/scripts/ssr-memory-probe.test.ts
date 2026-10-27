/** @jest-environment node */

import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir } from './cli-test-utils';

const { parseOptions, assertArticleHtml, fixtureEnvironment } = require('../../scripts/ssr-memory-probe.cjs');

describe('SSR memory probe target contract', () => {
  let fixtures: string;
  let args: string[];

  beforeAll(() => {
    const parent = path.resolve('.codex-temp', 'ssr-probe-tests');
    fs.mkdirSync(parent, { recursive: true });
    fixtures = makeTempDir('fixture-', { root: parent });
    fs.mkdirSync(path.join(fixtures, 'server', '_expo'), { recursive: true });
    fs.writeFileSync(path.join(fixtures, 'server', '_expo', 'routes.json'), '{}');
    fs.writeFileSync(path.join(fixtures, 'paths.txt'), '/travels/example\n/travels/second\n');
    args = ['--build', fixtures, '--paths', path.join(fixtures, 'paths.txt')];
  });

  afterAll(() => fs.rmSync(fixtures, { recursive: true, force: true }));

  it('requires a loopback API and defaults to both 5000-request gates', () => {
    const result = parseOptions([...args, '--api', 'http://127.0.0.1:8097']);
    expect(result).toMatchObject({
      paths: ['/travels/example', '/travels/second'], requests: 5000, warmup: 400,
      concurrencies: [1, 4], maxDrift: 30 * 1024 * 1024,
    });
  });

  it.each(['https://metravel.by', 'http://metravel.by', 'http://192.168.50.36', 'http://user:password@localhost:8000', 'http://localhost:8000/?api=production'])(
    'refuses external or credential-bearing API targets: %s', (api) => {
      expect(() => parseOptions([...args, '--api', api])).toThrow('loopback HTTP fixture API');
    },
  );

  it('refuses a run that would only measure warmup', () => {
    expect(() => parseOptions([...args, '--api', 'http://localhost:8000', '--requests', '400']))
      .toThrow('--requests must exceed --warmup');
  });

  it('refuses absolute remote paths', () => {
    const unsafePaths = path.join(fixtures, 'unsafe.txt');
    fs.writeFileSync(unsafePaths, '//metravel.by/travels/example\n');
    expect(() => parseOptions([...args, '--api', 'http://localhost:8000', '--paths', unsafePaths]))
      .toThrow('local absolute URL paths');
  });

  it('pins both loader API inputs and runtime mode despite inherited production values', () => {
    const saved = {
      SSR_API_ORIGIN: process.env.SSR_API_ORIGIN,
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_WEB_RUNTIME_SSR: process.env.EXPO_PUBLIC_WEB_RUNTIME_SSR,
      SPIKE_LOADER_API: process.env.SPIKE_LOADER_API,
    };
    try {
      Object.assign(process.env, {
        SSR_API_ORIGIN: 'https://metravel.by', EXPO_PUBLIC_API_URL: 'https://metravel.by',
        EXPO_PUBLIC_WEB_RUNTIME_SSR: 'false', SPIKE_LOADER_API: 'https://metravel.by',
      });
      const env = fixtureEnvironment('http://127.0.0.1:8097');
      expect(env).toMatchObject({
        SSR_API_ORIGIN: 'http://127.0.0.1:8097', EXPO_PUBLIC_API_URL: 'http://127.0.0.1:8097',
        EXPO_PUBLIC_WEB_RUNTIME_SSR: 'true',
        METRAVEL_WEB_OUTPUT: 'server',
      });
      expect(env.SPIKE_LOADER_API).toBeUndefined();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('rejects a loader JSON payload without a rendered article body', () => {
    const expected = { name: 'Fixture article', words: new Set(['only', 'inside', 'loader', 'data']) };
    const skeleton = '<html><body><h1>Fixture article</h1>'
      + '<div data-ssr-html-island="description"></div>'
      + '<script data-seo-jsonld="travel-article">{"description":"only inside loader data"}</script>'
      + '</body></html>';
    expect(() => assertArticleHtml(skeleton, expected, '/travels/example')).toThrow('content missing');

    const rendered = skeleton.replace('</div>', '<p>Only inside loader data</p></div>');
    expect(() => assertArticleHtml(rendered, expected, '/travels/example')).not.toThrow();
    expect(() => assertArticleHtml(rendered.replace('Fixture article</h1>', 'Wrong article</h1>'), expected, '/travels/example'))
      .toThrow('content missing');
  });
});
