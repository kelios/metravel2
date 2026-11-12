import fs from 'node:fs'
import path from 'node:path'
import { makeTempDir, removeDir, runNodeCli } from './cli-test-utils'

const prepare = path.resolve('scripts/prepare-web-ssr.js')

describe('packaged startup locale boundaries', () => {
  it('loads the real copied Node helpers without repository fallback and preserves all five locale contracts', () => {
    const dir = makeTempDir('startup-locale-runtime-')
    try {
      const exported = path.join(dir, 'export')
      const server = path.join(exported, 'server')
      const client = path.join(exported, 'client')
      const runtime = path.join(dir, 'runtime')
      const assets = '/_expo/static/js/web/entry-fixture.js'
      fs.mkdirSync(path.join(server, '_expo'), { recursive: true })
      fs.mkdirSync(path.dirname(path.join(client, assets)), { recursive: true })
      fs.writeFileSync(path.join(client, assets), 'globalThis.fixture=true;')
      const html = `<html><head><style id="metravel-critical-css">${'body{margin:0}'.repeat(400)}</style></head><body><div id="root"></div></body></html>`
      fs.writeFileSync(path.join(server, 'renderer.cjs'), `exports.resolveMetadata=async()=>null;exports.getStreamingContent=async()=>${JSON.stringify(html)};`)
      fs.writeFileSync(path.join(server, '_expo/routes.json'), JSON.stringify({
        rendering: { mode: 'ssr', file: 'renderer.cjs' },
        htmlRoutes: [{ file: 'index.js', page: '/(tabs)/index', namedRegex: '^/$' }],
        notFoundRoutes: [], apiRoutes: [], assets: { js: [assets], css: [] },
      }))
      const result = runNodeCli([prepare, '--export-dir', exported, '--static-dir', path.join(dir, 'dist'), '--runtime-dir', runtime], {
        EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR: 'false',
      })
      expect(result).toMatchObject({ status: 0, stderr: '' })
      const bootstrap = runNodeCli(['-e', `
        const assert = require('node:assert/strict');
        const leaf = require('./utils/questLocalePath');
        assert(!Object.keys(require.cache).some((file) => /questLocale(?:Routing|Shell)\\.js$/.test(file)));
        const facade = require('./utils/questLocaleRouting');
        const shell = require('./utils/questLocaleShell');
        const bridge = require('./utils/ssr/requestLocale');
        for (const name of Object.keys(leaf)) assert.equal(facade[name], leaf[name]);
        for (const name of Object.keys(shell)) assert.equal(facade[name], shell[name]);
        const inline = Function('return ' + shell.getQuestLocaleRouteParserScript())();
        for (const locale of ['ru', 'be', 'uk', 'pl', 'en']) {
          const prefix = locale === 'ru' ? '' : '/' + locale;
          const pathname = prefix + '/quests/1/check';
          assert.equal(facade.buildQuestLocalePath(1, 'check', locale), pathname);
          assert.equal(bridge.resolveRequestLocale(pathname), locale);
          assert.equal(bridge.resolveRequestLocale('/_expo/loaders' + pathname), locale);
          assert.equal(shell.buildQuestLocaleHubPath(locale), prefix + '/quests');
          assert.equal(leaf.parseQuestUrlLocale(pathname), locale === 'ru' ? null : locale);
          assert.deepEqual(inline(pathname), leaf.parseQuestLocaleRoute(pathname));
          assert.deepEqual(inline(prefix + '/quests'), leaf.parseQuestLocaleHubRoute(prefix + '/quests'));
        }
        for (const value of ['/de/quests/1/check', '/ru/quests/1/check', '/pl/quests/0/check', '/pl/search']) {
          assert.equal(leaf.parseQuestUrlLocale(value), null);
        }
        console.log('standalone locale boundaries pass');
      `], { NODE_PATH: '', NODE_OPTIONS: '' }, { cwd: runtime })
      expect(bootstrap).toEqual({ status: 0, stdout: 'standalone locale boundaries pass\n', stderr: '' })
    } finally { removeDir(dir) }
  })
})
