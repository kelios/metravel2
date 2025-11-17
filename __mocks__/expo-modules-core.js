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
  requireNativeViewManager: jest.fn(() => (props) => null),
  requireNativeModule,
  requireOptionalNativeModule,
  registerWebModule: jest.fn(),
  SharedRef: class {},
  initialize: jest.fn(),
  uuid: {
    v4: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
    v5: jest.fn(() => '00000000-0000-5000-8000-000000000000'),
  },
};

module.exports.default = module.exports;

