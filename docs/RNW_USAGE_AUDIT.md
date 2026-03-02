# RNW Usage Audit

> **Date:** 2026-03-02
> **Task:** I2.1 — Audit `import { ... } from 'react-native'` across the codebase
> **Purpose:** Identify tree-shake opportunities for react-native-web bundle

---

## Summary

~200+ files import from `'react-native'`. Most commonly used APIs:

### High-frequency APIs (used in 50+ files)
| API | Used by |
|-----|---------|
| `View` | Nearly every component |
| `Text` | Nearly every component |
| `StyleSheet` | Nearly every component |
| `Platform` | ~80+ files |
| `Pressable` | ~30+ files |

### Medium-frequency APIs (10–50 files)
| API | Used by |
|-----|---------|
| `ScrollView` | ~25 files |
| `ActivityIndicator` | ~20 files |
| `Image` | ~15 files |
| `Animated` | ~10 files |
| `TouchableOpacity` | ~10 files |
| `useWindowDimensions` | ~5 files |

### Low-frequency APIs (< 10 files)
| API | Used by |
|-----|---------|
| `Modal` | 3 files |
| `SafeAreaView` | 5 files |
| `RefreshControl` | 3 files |
| `Dimensions` | 4 files |
| `LayoutAnimation` | 3 files |
| `UIManager` | 2 files |
| `KeyboardAvoidingView` | 1 file |
| `TextInput` | 3 files |
| `Easing` | 1 file |
| `NativeSyntheticEvent` | 1 file |
| `InteractionManager` | 1 file |
| `AppState` | 2 files |
| `AccessibilityInfo` | 1 file |
| `StatusBar` | 2 files |

### Key directories
| Directory | Import count | Notes |
|-----------|-------------|-------|
| `app/` | ~35 | Pages, route components |
| `components/MapPage/` | ~35 | Map page components |
| `components/travel/` | ~15 | Travel detail components |
| `components/ui/` | ~20 | Shared UI components |
| `hooks/` | ~10 | Custom hooks |
| `utils/` | ~5 | Utilities |
| `context/` | ~3 | Context providers |

## Tree-shake Opportunities

### 1. `Platform.OS` checks
Many files import `Platform` only for `Platform.OS === 'web'` checks. These could be:
- Replaced with `.web.tsx` / `.native.tsx` platform files
- Pre-evaluated at build time via Metro `resolveRequest`

### 2. Heavy unused APIs on web
These RN APIs pull in large RNW modules but are rarely/never used on web:
- `Animated` → consider `react-native-reanimated` (already used elsewhere) or CSS transitions
- `LayoutAnimation` → CSS transitions on web
- `UIManager` → unused on web
- `Modal` → replaced by portal-based web modals in most cases
- `InteractionManager` → noop on web

### 3. `StyleSheet` tree-shaking
`StyleSheet.create()` is identity on web — could be replaced with plain objects, but low priority.

## Recommendations for I2.2–I2.4

1. **I2.2**: Create `metro-stubs/react-native-web-slim.js` that re-exports only the APIs listed above
2. **I2.3**: Measure bundle size before/after with `npx expo export --platform web`
3. **I2.4**: Document in ADR

---

## Risks
- Some third-party libraries (expo-location, @expo/vector-icons) internally import from react-native
- Metro resolver aliasing may break HMR in dev mode
- Need comprehensive E2E testing after any tree-shake changes

