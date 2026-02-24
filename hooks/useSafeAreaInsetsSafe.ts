/**
 * Safe wrapper for useSafeAreaInsets that handles broken module exports
 * on production web builds where react-native-safe-area-context may not
 * resolve correctly (e.g. missing SafeAreaProvider or broken chunk).
 *
 * On web, safe area insets are always zero (no notch), so falling back
 * to { top: 0, bottom: 0, left: 0, right: 0 } is correct behavior.
 */
import { Platform } from 'react-native';

let _hook: (() => { top: number; bottom: number; left: number; right: number }) | null = null;
let _resolved = false;

const WEB_ZERO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

function resolveHook() {
  if (_resolved) return;
  _resolved = true;
  try {
    const mod = require('react-native-safe-area-context');
    if (typeof mod.useSafeAreaInsets === 'function') {
      _hook = mod.useSafeAreaInsets;
    }
  } catch {
    // Module unavailable — keep _hook null.
  }
}

export function useSafeAreaInsetsSafe() {
  if (Platform.OS === 'web') {
    resolveHook();
    if (_hook) {
      try {
        return _hook();
      } catch {
        // Provider missing or hook threw — fall back.
      }
    }
    return WEB_ZERO_INSETS;
  }
  // On native, always use the real hook — it must work.
  resolveHook();
  return _hook!();
}
