class MockEventEmitter {
  addListener() {}
  removeAllListeners() {}
  removeSubscription() {}
  removeListener() {}
  emit() {}
  listenerCount() {
    return 0;
  }
}

class MockNativeModule {}
class MockSharedObject {}

class MockTransformStream {
  readable = {}
  writable = {}
}

const fallbackStructuredClone = (value) => {
  if (value == null) {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

const defineStableGlobal = (name, value) => {
  const existing = Object.getOwnPropertyDescriptor(globalThis, name)
  if (existing && existing.configurable === false) {
    return
  }

  Object.defineProperty(globalThis, name, {
    value,
    configurable: false,
    enumerable: false,
    writable: true,
  })
}

if (!globalThis.expo) {
  globalThis.expo = {};
}

const originalConsoleError = console.error
console.error = (message, ...args) => {
  if (String(message).startsWith('Failed to set polyfill.')) {
    return
  }

  originalConsoleError(message, ...args)
}

globalThis.process = globalThis.process || {};
globalThis.process.env = globalThis.process.env || {};
// В тестах по умолчанию используем реальный dev API, чтобы не было фоллбэка на window.location.origin (127.0.0.1:8085).
// Если нужно другое окружение, задайте EXPO_PUBLIC_API_URL перед запуском Jest.
globalThis.process.env.EXPO_PUBLIC_API_URL =
  globalThis.process.env.EXPO_PUBLIC_API_URL || 'http://192.168.50.36';

globalThis.expo.EventEmitter = globalThis.expo.EventEmitter || MockEventEmitter;
globalThis.expo.NativeModule = globalThis.expo.NativeModule || MockNativeModule;
globalThis.expo.SharedObject = globalThis.expo.SharedObject || MockSharedObject;
globalThis.expo.NativeModulesProxy = globalThis.expo.NativeModulesProxy || {};
// jest-expo@56 preset setup пишет ExpoFetchModule в globalThis.expo.modules
globalThis.expo.modules = globalThis.expo.modules || {};

defineStableGlobal('TextEncoderStream', globalThis.TextEncoderStream || MockTransformStream)
defineStableGlobal('TextDecoderStream', globalThis.TextDecoderStream || MockTransformStream)
defineStableGlobal('structuredClone', globalThis.structuredClone || fallbackStructuredClone)
defineStableGlobal('__ExpoImportMetaRegistry', globalThis.__ExpoImportMetaRegistry || class MockExpoImportMetaRegistry {})

// Polyfill setImmediate for jsdom environment
if (typeof setImmediate === 'undefined') {
  globalThis.setImmediate = (fn) => setTimeout(fn, 0);
}
