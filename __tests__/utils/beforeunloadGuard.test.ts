import { Platform } from 'react-native';

import { addBeforeUnloadListener, isUnloadAllowed } from '../../utils/beforeunloadGuard';

describe('beforeunloadGuard', () => {
  const originalPlatform = Platform.OS;
  const originalPermissionsPolicy = Object.getOwnPropertyDescriptor(document, 'permissionsPolicy');
  const originalFeaturePolicy = Object.getOwnPropertyDescriptor(document, 'featurePolicy');

  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', {
      value: os,
      configurable: true,
    });
  };

  const restoreDocumentPolicy = (
    key: 'permissionsPolicy' | 'featurePolicy',
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Object.defineProperty(document, key, descriptor);
      return;
    }

    delete (document as Document & { [K in typeof key]?: unknown })[key];
  };

  beforeEach(() => {
    setPlatformOs('web');
    restoreDocumentPolicy('permissionsPolicy', originalPermissionsPolicy);
    restoreDocumentPolicy('featurePolicy', originalFeaturePolicy);
  });

  afterAll(() => {
    setPlatformOs(originalPlatform);
    restoreDocumentPolicy('permissionsPolicy', originalPermissionsPolicy);
    restoreDocumentPolicy('featurePolicy', originalFeaturePolicy);
  });

  it('returns false when legacy featurePolicy blocks unload', () => {
    delete (document as Document & { permissionsPolicy?: unknown }).permissionsPolicy;
    Object.defineProperty(document, 'featurePolicy', {
      configurable: true,
      value: {
        allowsFeature: jest.fn((feature: string) => feature !== 'unload'),
      },
    });

    expect(isUnloadAllowed()).toBe(false);
  });

  it('does not attach beforeunload listener when featurePolicy blocks unload', () => {
    delete (document as Document & { permissionsPolicy?: unknown }).permissionsPolicy;
    Object.defineProperty(document, 'featurePolicy', {
      configurable: true,
      value: {
        allowsFeature: jest.fn(() => false),
      },
    });

    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    const cleanup = addBeforeUnloadListener(jest.fn());

    expect(cleanup).toBeNull();
    expect(addEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addEventListenerSpy.mockRestore();
  });

  it('uses permissionsPolicy when available', () => {
    Object.defineProperty(document, 'permissionsPolicy', {
      configurable: true,
      value: {
        allowsFeature: jest.fn(() => true),
      },
    });
    Object.defineProperty(document, 'featurePolicy', {
      configurable: true,
      value: {
        allowsFeature: jest.fn(() => false),
      },
    });

    expect(isUnloadAllowed()).toBe(true);
  });
});
