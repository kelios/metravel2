/* global jest, module */

const createMockEmitter = () => ({
  addListener: jest.fn(),
  removeAllListeners: jest.fn(),
  removeSubscription: jest.fn(),
  removeListener: jest.fn(),
  emit: jest.fn(),
  listenerCount: jest.fn(() => 0),
});

class EventEmitter {
  constructor() {
    const emitter = createMockEmitter();
    Object.assign(this, emitter);
  }
}

class NativeModule {}
class SharedObject {}

const NativeModulesProxy = {};

const requireNativeModule = () => ({});
const requireOptionalNativeModule = () => ({});

module.exports = {
  // Used by jest-expo preset setup (expo-modules-core/src/polyfill/dangerous-internal)
  installExpoGlobalPolyfill: jest.fn(),
  EventEmitter,
  LegacyEventEmitter: EventEmitter,
  NativeModule,
  SharedObject,
  NativeModulesProxy,
  Platform: {
    OS: 'web',
    select: (variants = {}) =>
      variants.web ?? variants.default ?? variants.native ?? variants,
  },
  requireNativeViewManager: jest.fn(() => () => null),
  requireNativeModule,
  requireOptionalNativeModule,
  // Used by expo-location and other permissioned Expo modules.
  // Must be defined at module-eval time (hooks are created during import).
  createPermissionHook: jest.fn(() => {
    return function usePermissionHookMock() {
      return [
        { status: 'granted', granted: true, canAskAgain: true, expires: 'never' },
        jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' })),
      ];
    };
  }),
  registerWebModule: jest.fn(),
  SharedRef: class {},
  initialize: jest.fn(),
  uuid: {
    v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
    v5: jest.fn(() => '00000000-0000-5000-8000-000000000000'),
  },
};

module.exports.default = module.exports;
