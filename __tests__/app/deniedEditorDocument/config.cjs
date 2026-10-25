'use strict'
/* global require, module, __dirname */
// Reuse the actual RN-Web resolver/DOM adapters already used by SSR fixtures.
const web = require('../tripsStaticRender/config.cjs')
const base = require('../../../jest.config.js')
const path = require('node:path')
module.exports = {
  ...web,
  roots: [__dirname],
  testMatch: ['**/deniedEditorDocument/fixture.tsx'],
  setupFilesAfterEnv: base.setupFilesAfterEnv,
  setupFiles: [...web.setupFiles, path.join(__dirname, 'setup.cjs')],
  // Production Metro enables async routes. Babel compiles import-mode reads
  // from caller metadata, so setting an environment variable is insufficient.
  transform: Object.fromEntries(Object.entries(web.transform).map(([key, value]) => [key,
    // Match the resolved babel-jest path (jest-expo 58), not only the bare 'babel-jest' string (SDK 57).
    Array.isArray(value) && /(?:^|\/)babel-jest(?:\/|$)/.test(String(value[0]))
      ? [value[0], { ...value[1], caller: { ...value[1].caller, asyncRoutes: true } }]
      : value,
  ])),
  transformIgnorePatterns: web.transformIgnorePatterns.map(pattern => pattern.replace('node_modules/(?!', 'node_modules/(?!standard-navigation|')),
}
