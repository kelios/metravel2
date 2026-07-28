import * as FileSystem from 'expo-file-system/legacy';
import type { OfflinePackagePayload } from './types';
import type { OfflinePackageStore } from './packageStore.types';
import { utf8ByteLength } from './byteLength';

const ROOT = `${FileSystem.documentDirectory ?? ''}offline-content/v1/`;
const safeKey = (key: string) => encodeURIComponent(key);
const finalPath = (key: string) => `${ROOT}${safeKey(key)}.json`;

const ensureRoot = async (): Promise<void> => {
  const info = await FileSystem.getInfoAsync(ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  }
};

const packageStore: OfflinePackageStore = {
  async read<T>(key: string): Promise<OfflinePackagePayload<T> | null> {
    try {
      const path = finalPath(key);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists || info.isDirectory) return null;
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw) as OfflinePackagePayload<T>;
      return parsed?.schemaVersion === 1 ? parsed : null;
    } catch {
      return null;
    }
  },

  async write<T>(key: string, payload: OfflinePackagePayload<T>) {
    await ensureRoot();
    const destination = finalPath(key);
    const transactionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const staging = `${ROOT}${safeKey(key)}.${transactionId}.staging.json`;
    const backup = `${ROOT}${safeKey(key)}.${transactionId}.backup.json`;
    const raw = JSON.stringify(payload);
    let hasBackup = false;

    await FileSystem.writeAsStringAsync(staging, raw);
    const stagedInfo = await FileSystem.getInfoAsync(staging);
    if (!stagedInfo.exists || stagedInfo.isDirectory) {
      throw new Error('OFFLINE_PACKAGE_STAGING_FAILED');
    }

    try {
      const currentInfo = await FileSystem.getInfoAsync(destination);
      if (currentInfo.exists && !currentInfo.isDirectory) {
        await FileSystem.moveAsync({ from: destination, to: backup });
        hasBackup = true;
      }
      await FileSystem.moveAsync({ from: staging, to: destination });
    } catch (error) {
      await FileSystem.deleteAsync(staging, { idempotent: true }).catch(() => undefined);
      if (hasBackup) {
        await FileSystem.moveAsync({ from: backup, to: destination }).catch(() => undefined);
      }
      throw error;
    }

    if (hasBackup) {
      await FileSystem.deleteAsync(backup, { idempotent: true }).catch(() => undefined);
    }

    return {
      bytes: typeof stagedInfo.size === 'number'
        ? stagedInfo.size
        : utf8ByteLength(raw),
      includesAssetBytes: false,
    };
  },

  async remove(key: string): Promise<void> {
    await FileSystem.deleteAsync(finalPath(key), { idempotent: true });
  },
};

export default packageStore;
