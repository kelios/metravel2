import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { usePdfExport } from '@/src/hooks/usePdfExport';
import type { ExportConfig } from '@/src/types/pdf-export';

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
  pdfExport: ReturnType<typeof usePdfExport>;
  baseSettings: BookSettings;
  lastSettings: BookSettings;
  setLastSettings: Dispatch<SetStateAction<BookSettings>>;
  settingsSummary: string;
  handleSaveWithSettings: (settings: BookSettings) => Promise<void>;
  handlePreviewWithSettings: (settings: BookSettings) => Promise<void>;
}

export function useListTravelExport(
  travels: Travel[] = [],
  { ownerName, pdfConfig }: UseListTravelExportOptions = {}
): UseListTravelExportReturn {
  const [selected, setSelected] = useState<Travel[]>([]);
  const pdfExport = usePdfExport(selected, pdfConfig);

  useEffect(() => {
    if (!selected.length) return;
    setSelected((prev) => prev.filter((travel) => travels.some((item) => item.id === travel.id)));
  }, [travels, selected.length]);

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

  const selectedIds = useMemo(() => new Set((selected || []).map((item) => item.id ?? item.slug)), [selected]);

  const isSelected = useCallback(
    (id: number | string) => {
      return selectedIds.has(id);
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
      format: 'A4',
      orientation: 'portrait',
      margins: 'standard',
      imageQuality: 'high',
      sortOrder: 'date-desc',
      includeToc: true,
      includeGallery: true,
      includeMap: true,
      colorTheme: 'blue',
      fontFamily: 'sans',
      photoMode: 'gallery',
      mapMode: 'full-page',
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
    const orientation = lastSettings.orientation === 'landscape' ? 'Альбомная' : 'Книжная';
    const format = lastSettings.format?.toUpperCase?.() || 'A4';
    const template = lastSettings.template || 'minimal';
    return `${format} • ${orientation} • ${template}`;
  }, [lastSettings]);

  const handleSaveWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.exportPdf(settings);
    },
    [pdfExport]
  );

  const handlePreviewWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.previewPdf(settings);
    },
    [pdfExport]
  );

  return {
    selected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isSelected,
    hasSelection: selectionCount > 0,
    selectionCount,
    pdfExport,
    baseSettings,
    lastSettings,
    setLastSettings,
    settingsSummary,
    handleSaveWithSettings,
    handlePreviewWithSettings,
  };
}
