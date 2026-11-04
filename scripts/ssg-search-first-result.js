const path = require('node:path');
const { buildSync } = require('esbuild');

let script;

function buildSearchFirstResultScript() {
  if (script != null) return script;

  // The same media resolver and card geometry run in the early web shell and
  // the hydrated list. Use the real web Platform export without loading React.
  const result = buildSync({
    absWorkingDir: path.join(__dirname, '..'),
    stdin: {
      contents: 'import { mountSearchFirstResult } from "./scripts/search-first-result"; void mountSearchFirstResult();',
      resolveDir: path.join(__dirname, '..'),
    },
    alias: { 'react-native': require.resolve('react-native-web/dist/index.js') },
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.EXPO_PUBLIC_API_URL': process.env.EXPO_PUBLIC_API_URL
        ? JSON.stringify(process.env.EXPO_PUBLIC_API_URL)
        : 'window.location.origin',
      'process.env.EXPO_PUBLIC_IS_LOCAL_API': JSON.stringify(process.env.EXPO_PUBLIC_IS_LOCAL_API ?? ''),
      'process.env.EXPO_PUBLIC_E2E': JSON.stringify(process.env.EXPO_PUBLIC_E2E ?? ''),
      'process.env.PROD_API_URL': '""',
    },
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
  });
  script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  return script;
}

module.exports = { buildSearchFirstResultScript };
