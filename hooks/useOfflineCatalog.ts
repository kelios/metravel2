import { useCallback, useEffect, useState } from 'react';
import { offlineCatalog } from '@/services/offline/offlineCatalog';
import { offlineOperations } from '@/services/offline/offlineOperations';
import type {
  OfflinePackageManifest,
  OfflinePackageOperation,
  OfflineStorageSummary,
} from '@/services/offline/types';

const EMPTY_SUMMARY: OfflineStorageSummary = {
  packageCount: 0,
  pinnedCount: 0,
  recentCount: 0,
  bytes: 0,
};

export function useOfflineCatalog(currentUserId?: string | number | null) {
  const [items, setItems] = useState<OfflinePackageManifest[]>([]);
  const [summary, setSummary] = useState<OfflineStorageSummary>(EMPTY_SUMMARY);
  const [operations, setOperations] = useState<OfflinePackageOperation[]>(() => offlineOperations.list());
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextItems, nextSummary] = await Promise.all([
      offlineCatalog.list(currentUserId),
      offlineCatalog.summary(currentUserId),
    ]);
    setItems(nextItems);
    setSummary(nextSummary);
    setIsLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    void refresh();
    const unsubscribeCatalog = offlineCatalog.subscribe(() => {
      void refresh();
    });
    const unsubscribeOperations = offlineOperations.subscribe(() => {
      setOperations(offlineOperations.list());
    });
    return () => {
      unsubscribeCatalog();
      unsubscribeOperations();
    };
  }, [refresh]);

  return {
    items,
    summary,
    operations,
    isLoading,
    refresh,
    remove: offlineCatalog.remove.bind(offlineCatalog),
    setPinned: offlineCatalog.setPinned.bind(offlineCatalog),
    cancelOperation: offlineOperations.cancel.bind(offlineOperations),
    retryOperation: offlineOperations.retry.bind(offlineOperations),
    clearOperation: offlineOperations.clear.bind(offlineOperations),
  };
}
