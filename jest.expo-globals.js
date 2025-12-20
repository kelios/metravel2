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
globalThis.process.env.EXPO_PUBLIC_API_URL =
  globalThis.process.env.EXPO_PUBLIC_API_URL || 'https://example.test/api';

globalThis.expo.EventEmitter = globalThis.expo.EventEmitter || MockEventEmitter;
globalThis.expo.NativeModule = globalThis.expo.NativeModule || MockNativeModule;
globalThis.expo.SharedObject = globalThis.expo.SharedObject || MockSharedObject;
globalThis.expo.NativeModulesProxy = globalThis.expo.NativeModulesProxy || {};

// Polyfill setImmediate for jsdom environment
if (typeof setImmediate === 'undefined') {
  globalThis.setImmediate = (fn) => setTimeout(fn, 0);
}
