import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflinePackagePayload } from './types';
import type { OfflinePackageStore } from './packageStore.types';
import { utf8ByteLength } from './byteLength';

const PACKAGE_PREFIX = 'offline-package:v1:';
const packageKey = (key: string) => `${PACKAGE_PREFIX}${key}`;

// Jest/SSR fallback. Metro selects packageStore.native.ts or .web.ts at runtime.
const packageStore: OfflinePackageStore = {
  async read<T>(key: string): Promise<OfflinePackagePayload<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(packageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OfflinePackagePayload<T>;
      return parsed?.schemaVersion === 1 ? parsed : null;
    } catch {
      return null;
    }
  },

  async write<T>(key: string, payload: OfflinePackagePayload<T>) {
    const raw = JSON.stringify(payload);
    await AsyncStorage.setItem(packageKey(key), raw);
    return { bytes: utf8ByteLength(raw), includesAssetBytes: true };
  },

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(packageKey(key));
  },
};

export default packageStore;
