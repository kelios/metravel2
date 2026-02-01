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

if (!globalThis.expo) {
  globalThis.expo = {};
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

// Polyfill setImmediate for jsdom environment
if (typeof setImmediate === 'undefined') {
  globalThis.setImmediate = (fn) => setTimeout(fn, 0);
}
