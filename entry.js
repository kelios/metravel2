'use strict';

// ✅ FIX: Patch Object.defineProperty FIRST, before any require/import
// In Expo web dev with lazy=true, Metro can occasionally re-evaluate a chunk that contains
// an ESM->CJS wrapper for some packages (notably react-leaflet). The wrapper re-defines
// exports.default via Object.defineProperty, and the second evaluation throws:
// "TypeError: Cannot redefine property: default"
// We treat that specific case as idempotent and ignore the redefinition attempt.
// This MUST be applied before any require() or import() of react-leaflet.
(function() {
  const isWebPlatform = typeof window !== 'undefined' || typeof document !== 'undefined';
  if (!isWebPlatform) return;

  const w = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  if (w.__metravelDefinePropertyPatched) return;
  w.__metravelDefinePropertyPatched = true;

  const originalDefineProperty = Object.defineProperty;
  const originalDefineProperties = Object.defineProperties;
  const originalReflectDefineProperty = typeof Reflect !== 'undefined' && Reflect.defineProperty
    ? Reflect.defineProperty.bind(Reflect)
    : null;

  const shouldIgnoreDefaultRedefine = function(prop, err) {
    const msg = err && (err.message || String(err));
    if (typeof msg !== 'string') return false;
    if (msg.indexOf('Cannot redefine property: default') === -1) return false;
    return prop === 'default' || prop == null;
  };

  Object.defineProperty = function patchedDefineProperty(obj, prop, descriptor) {
    try {
      return originalDefineProperty(obj, prop, descriptor);
    } catch (err) {
      if (shouldIgnoreDefaultRedefine(prop, err)) {
        return obj;
      }
      throw err;
    }
  };

  Object.defineProperties = function patchedDefineProperties(obj, props) {
    try {
      return originalDefineProperties(obj, props);
    } catch (err) {
      if (props && typeof props === 'object') {
        for (var key in props) {
          if (Object.prototype.hasOwnProperty.call(props, key)) {
            try {
              originalDefineProperty(obj, key, props[key]);
            } catch (e) {
              if (shouldIgnoreDefaultRedefine(key, e)) continue;
              throw e;
            }
          }
        }
        return obj;
      }
      throw err;
    }
  };

  if (originalReflectDefineProperty) {
    Reflect.defineProperty = function patchedReflectDefineProperty(obj, prop, attributes) {
      try {
        return originalReflectDefineProperty(obj, prop, attributes);
      } catch (err) {
        if (shouldIgnoreDefaultRedefine(prop, err)) {
          return true;
        }
        throw err;
      }
    };
  }
})();

// Import gesture handler at the very top for proper initialization
if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  require('react-native-gesture-handler');
}

if (typeof globalThis !== 'undefined' && typeof globalThis._WORKLET === 'undefined') {
  globalThis._WORKLET = false;
}

if (
  typeof globalThis !== 'undefined' &&
  typeof globalThis._getAnimationTimestamp !== 'function'
) {
  globalThis._getAnimationTimestamp = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  };
}

// Suppress noisy React Native Web AppRegistry startup banner.
// This banner is printed by react-native-web when NODE_ENV is not production/test.
// We filter only that specific message to keep other logs intact.
const originalInfo = console.info;
console.info = (...args) => {
  const first = args[0];
  if (typeof first === 'string' && first.startsWith('Running application "main" with appParams:')) {
    return;
  }
  return originalInfo(...args);
};

// Suppress FontFaceObserver timeout errors that often surface as
// `Uncaught (in promise) Error: 6000ms timeout exceeded` on web.
// We only prevent default for this specific known case.
// Additionally, patch FontFaceObserver to use a longer timeout and swallow its timeout rejection.
try {
  const FFO = require('fontfaceobserver');
  const proto = FFO && FFO.prototype;
  if (proto && !proto.__patchedTimeout) {
    const originalLoad = proto.load;
    proto.load = function patchedLoad(text, timeout) {
      const safeTimeout = typeof timeout === 'number' ? timeout : 20000; // extend to 20s
      return originalLoad.call(this, text, safeTimeout).catch((err) => {
        if (err && typeof err.message === 'string' && err.message.includes('timeout exceeded')) {
          return undefined; // resolve instead of reject on timeout
        }
        throw err;
      });
    };
    proto.__patchedTimeout = true;
    if (typeof globalThis !== 'undefined' && !globalThis.FontFaceObserver) {
      globalThis.FontFaceObserver = FFO;
    }
  }
} catch {
  // If fontfaceobserver is unavailable, skip patching.
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('error', (event) => {
    const message =
      typeof event?.message === 'string'
        ? event.message
        : event?.error && typeof event.error.message === 'string'
          ? event.error.message
          : '';

    const stack =
      event?.error && typeof event.error.stack === 'string'
        ? event.error.stack
        : '';

    const filename = typeof event?.filename === 'string' ? event.filename : '';

    const isFontObserverTimeout =
      message.includes('timeout exceeded') &&
      (stack.toLowerCase().includes('fontfaceobserver') ||
        filename.toLowerCase().includes('fontfaceobserver') ||
        message.toLowerCase().includes('fontfaceobserver'));

    if (isFontObserverTimeout) {
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;

    const message =
      typeof reason === 'string'
        ? reason
        : reason && typeof reason.message === 'string'
          ? reason.message
          : '';

    const stack =
      reason && typeof reason.stack === 'string'
        ? reason.stack
        : '';

    const isFontObserverTimeout =
      message.includes('timeout exceeded') &&
      (stack.toLowerCase().includes('fontfaceobserver') ||
        message.toLowerCase().includes('fontfaceobserver'));

    if (isFontObserverTimeout) {
      event.preventDefault();
    }
  });
}


require('expo-router/entry');
