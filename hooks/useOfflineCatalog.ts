import { useCallback, useEffect, useState } from 'react';
import { offlineCatalog } from '@/services/offline/offlineCatalog';
import type { OfflinePackageManifest, OfflineStorageSummary } from '@/services/offline/types';

const EMPTY_SUMMARY: OfflineStorageSummary = {
  packageCount: 0,
  pinnedCount: 0,
  recentCount: 0,
  bytes: 0,
};

export function useOfflineCatalog(currentUserId?: string | number | null) {
  const [items, setItems] = useState<OfflinePackageManifest[]>([]);
  const [summary, setSummary] = useState<OfflineStorageSummary>(EMPTY_SUMMARY);
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
    return offlineCatalog.subscribe(() => {
      void refresh();
    });
  }, [refresh]);

  return {
    items,
    summary,
    isLoading,
    refresh,
    remove: offlineCatalog.remove.bind(offlineCatalog),
    setPinned: offlineCatalog.setPinned.bind(offlineCatalog),
  };
}
