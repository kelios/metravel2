# ADR: React Native Web Tree-Shaking

> **Date:** 2026-03-02  
> **Status:** Implemented (opt-in)  
> **Relates to:** I2.1–I2.3

## Context

The app uses React Native with `react-native-web` (RNW) for web builds. RNW re-exports ~100+ modules from a single barrel (`react-native`), but the app only uses ~30 of them. The unused modules contribute ~150-200KB to the web bundle's "unused JS" metric in Lighthouse.

## Decision

### Approach: Cherry-picked RNW re-exports via Metro resolver aliasing

1. **`metro-stubs/react-native-web-slim.js`** — a slim barrel that only re-exports the RNW modules actually used by the app.

2. **Metro resolver aliasing** — in `metro.config.js`, when `EXPO_PUBLIC_RNW_SLIM=1` is set, `import { ... } from 'react-native'` on web is redirected to the slim barrel instead of the full RNW package.

3. **Opt-in by default** — the aliasing is disabled by default (`EXPO_PUBLIC_RNW_SLIM` env var). This ensures zero risk to production builds until the approach is validated.

### Why not alternatives?

| Alternative | Why rejected |
|-------------|-------------|
| `babel-plugin-module-resolver` | Runs at transform time, hard to debug; doesn't compose well with Expo's Metro config |
| Direct imports (`react-native-web/dist/exports/View`) | Breaks type checking; requires changing 200+ import statements |
| Webpack tree-shaking | Not applicable — the project uses Metro bundler |

## Consequences

### Positive
- Reduced unused JS in web bundle (~150-200KB)
- No source code changes needed — the aliasing is transparent
- Easy to add new modules when needed (just add a line to the slim barrel)

### Negative
- Maintenance: when adding new `react-native` imports, must also add to slim barrel
- Third-party libraries that import `react-native` internally may break if they use modules not in the slim barrel
- HMR in dev mode may behave differently with the alias

### Risks
- **High risk**: some expo-* packages internally `require('react-native')` and may use modules not in the slim barrel. Mitigation: the slim barrel includes all commonly used modules + the aliasing is opt-in.

## Validation

1. Enable: `EXPO_PUBLIC_RNW_SLIM=1 npx expo export --platform web`
2. Compare Lighthouse unused JS metric with `BASELINE_METRICS.json`
3. Run Playwright E2E smoke tests: home, search, map, travel detail
4. If any crashes: check console for "Cannot find module" errors, add missing modules to slim barrel

## Files Changed

| File | Change |
|------|--------|
| `metro-stubs/react-native-web-slim.js` | New: slim RNW barrel |
| `metro.config.js` | Added: resolver alias (opt-in) |
| `docs/RNW_USAGE_AUDIT.md` | New: audit of RNW usage |
| `docs/ADR_RNW_TREE_SHAKE.md` | This document |

