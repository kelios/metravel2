import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { ExportConfig } from '@/types/pdf-export';

interface UseListTravelExportOptions {
  ownerName?: string | null;
  pdfConfig?: ExportConfig;
}

export interface UseListTravelExportReturn {
  selected: Travel[];
  toggleSelect: (travel: Travel) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  moveSelected: (id: number | string, direction: 'up' | 'down') => void;
  moveSelectedTo: (id: number | string, targetId: number | string) => void;
  isSelected: (id: number | string) => boolean;
  hasSelection: boolean;
  selectionCount: number;
  baseSettings: BookSettings;
  lastSettings: BookSettings;
  setLastSettings: Dispatch<SetStateAction<BookSettings>>;
  settingsSummary: string;
  handleSaveWithSettings: (settings: BookSettings) => Promise<void>;
  handlePreviewWithSettings: (settings: BookSettings) => Promise<void>;
}

export function useListTravelExport(
  travels: Travel[] = [],
  { ownerName }: UseListTravelExportOptions = {}
): UseListTravelExportReturn {
  const [selected, setSelected] = useState<Travel[]>([]);

  useEffect(() => {
    setSelected((prev) => {
      if (!prev.length) return prev;
      let changed = false;
      const next = prev.map((travel) => {
        const updated = travels.find((item) => item.id === travel.id);
        if (!updated) return travel;
        if (updated === travel) return travel;
        changed = true;
        return {
          ...travel,
          ...updated,
        };
      });
      return changed ? next : prev;
    });
  }, [travels]);

  const toggleSelect = useCallback((travel: Travel) => {
    setSelected((prev) =>
      prev.find((item) => item.id === travel.id) ? prev.filter((item) => item.id !== travel.id) : [...prev, travel]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!travels.length) return;
    setSelected((prev) => {
      const visibleIds = new Set(travels.map((travel) => String(travel.id ?? travel.slug)));
      const allVisibleSelected = travels.every((travel) =>
        prev.some((item) => String(item.id ?? item.slug) === String(travel.id ?? travel.slug))
      );

      if (allVisibleSelected) {
        return prev.filter((item) => !visibleIds.has(String(item.id ?? item.slug)));
      }

      const next = [...prev];
      travels.forEach((travel) => {
        const alreadySelected = next.some(
          (item) => String(item.id ?? item.slug) === String(travel.id ?? travel.slug)
        );
        if (!alreadySelected) {
          next.push(travel);
        }
      });
      return next;
    });
  }, [travels]);

  const clearSelection = useCallback(() => setSelected([]), []);

  const moveSelected = useCallback((id: number | string, direction: 'up' | 'down') => {
    setSelected((prev) => {
      const index = prev.findIndex((item) => String(item.id ?? item.slug) === String(id));
      if (index < 0) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, []);

  const moveSelectedTo = useCallback((id: number | string, targetId: number | string) => {
    setSelected((prev) => {
      const sourceIndex = prev.findIndex((item) => String(item.id ?? item.slug) === String(id));
      const targetIndex = prev.findIndex((item) => String(item.id ?? item.slug) === String(targetId));
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return prev;

      const next = [...prev];
      const [item] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, []);

  const selectedIds = useMemo(() => new Set((selected || []).map((item) => String(item.id ?? item.slug))), [selected]);

  const isSelected = useCallback(
    (id: number | string) => {
      return selectedIds.has(String(id));
    },
    [selectedIds]
  );

  const selectionCount = selected.length;

  const baseSettings = useMemo<BookSettings>(
    () => ({
      title: ownerName ? `Путешествия ${ownerName}` : 'Мои путешествия',
      subtitle: '',
      coverType: 'auto',
      template: 'minimal',
      sortOrder: 'manual',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      includeChecklists: false,
      checklistSections: ['clothing', 'food', 'electronics'],
    }),
    [ownerName]
  );

  const [lastSettings, setLastSettings] = useState<BookSettings>(baseSettings);

  useEffect(() => {
    setLastSettings(baseSettings);
  }, [baseSettings]);

  const settingsSummary = useMemo(() => {
    const template = lastSettings.template || 'minimal';
    return `${template}`;
  }, [lastSettings]);

  const handleSaveWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      return Promise.resolve();
    },
    []
  );

  const handlePreviewWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      return Promise.resolve();
    },
    []
  );

  return {
    selected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    moveSelected,
    moveSelectedTo,
    isSelected,
    hasSelection: selectionCount > 0,
    selectionCount,
    baseSettings,
    lastSettings,
    setLastSettings,
    settingsSummary,
    handleSaveWithSettings,
    handlePreviewWithSettings,
  };
}
