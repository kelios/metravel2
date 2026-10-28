/**
 * Web production minify keeps UTF-8 in locale bundles (#2089).
 * Metro/terser default `ascii_only` rewrites Cyrillic as `\uXXXX` and
 * almost doubles the raw size of be/uk packs. Native builds do not set
 * EXPO_WEB_BUILD_MINIFY, so they keep Metro's own minifier defaults.
 */
function applyWebBuildMinifier(transformer, env = process.env) {
  const next = transformer || {}
  if (env.EXPO_WEB_BUILD_MINIFY !== 'true') return next
  const minifierConfig = next.minifierConfig || {}
  return {
    ...next,
    minifierConfig: {
      ...minifierConfig,
      output: {
        ...(minifierConfig.output || {}),
        ascii_only: false,
      },
    },
  }
}

module.exports = { applyWebBuildMinifier }
