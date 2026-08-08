// Expo Router's stock web context includes `.native`, `.android`, and `.ios`
// route files in the Metro graph. The router ignores those files at runtime,
// but Metro still treats them as async roots and hoists their shared imports
// into the eagerly loaded `__common` chunk.
//
// Keep the upstream special-route exclusions while limiting the client web
// graph to fallback and `.web` routes. Native builds keep Expo Router's stock
// context and are unaffected.
export const ctx = require.context(
  process.env.EXPO_ROUTER_APP_ROOT,
  true,
  /^(?:\.\/)(?!(?:(?:(?:.*\+api)|(?:\+middleware)|(?:\+(html|native-intent))))\.[tj]sx?$)(?!.*\.(?:android|ios|native)\.[tj]sx?$).*\.[tj]sx?$/,
  // This project fixes Expo Router web async routes to `true` in app.json.
  // The Expo Babel transform only inlines EXPO_ROUTER_IMPORT_MODE inside the
  // package-owned `_ctx` module, so a project-owned context must keep the mode
  // literal or Metro silently falls back to a synchronous route graph.
  'lazy'
)
