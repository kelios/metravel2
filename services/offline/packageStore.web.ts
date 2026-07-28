import type { OfflinePackagePayload } from './types';
import type { OfflinePackageStore } from './packageStore.types';
import { utf8ByteLength } from './byteLength';

const DATABASE_NAME = 'metravel-offline-v1';
const DATABASE_VERSION = 1;
const STORE_NAME = 'packages';

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('OFFLINE_INDEXED_DB_UNAVAILABLE'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('OFFLINE_INDEXED_DB_OPEN_FAILED'));
  });

const packageStore: OfflinePackageStore = {
  async read<T>(key: string): Promise<OfflinePackagePayload<T> | null> {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        request.onsuccess = () => {
          const value = request.result as OfflinePackagePayload<T> | undefined;
          resolve(value?.schemaVersion === 1 ? value : null);
        };
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  },

  async write<T>(key: string, payload: OfflinePackagePayload<T>) {
    const raw = JSON.stringify(payload);
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(payload, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('OFFLINE_INDEXED_DB_WRITE_ABORTED'));
      });
    } finally {
      database.close();
    }
    return { bytes: utf8ByteLength(raw), includesAssetBytes: true };
  },

  async remove(key: string): Promise<void> {
    const database = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },
};

export default packageStore;
