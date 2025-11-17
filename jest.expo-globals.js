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

globalThis.expo.EventEmitter = globalThis.expo.EventEmitter || MockEventEmitter;
globalThis.expo.NativeModule = globalThis.expo.NativeModule || MockNativeModule;
globalThis.expo.SharedObject = globalThis.expo.SharedObject || MockSharedObject;
globalThis.expo.NativeModulesProxy = globalThis.expo.NativeModulesProxy || {};

