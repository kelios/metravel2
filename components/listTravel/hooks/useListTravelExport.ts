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
      const next = prev.filter((travel) => travels.some((item) => item.id === travel.id));
      return next.length === prev.length ? prev : next;
    });
  }, [travels]);

  const toggleSelect = useCallback((travel: Travel) => {
    setSelected((prev) =>
      prev.find((item) => item.id === travel.id) ? prev.filter((item) => item.id !== travel.id) : [...prev, travel]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!travels.length) return;
    setSelected((prev) => (prev.length === travels.length ? [] : travels));
  }, [travels]);

  const clearSelection = useCallback(() => setSelected([]), []);

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
      sortOrder: 'date-desc',
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
