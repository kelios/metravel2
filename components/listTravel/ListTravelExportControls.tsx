import React, { useCallback, useMemo, useState } from 'react';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { ExportConfig } from '@/types/pdf-export';
import { usePdfExport } from '@/hooks/usePdfExport';
import { ExportBar } from './ExportBar';
import BookSettingsModal from '@/components/export/BookSettingsModal';
import { createStyles } from './listTravelStyles';

type ExportBarStyles = ReturnType<typeof createStyles>;

type Props = {
  isMobile: boolean;
  travels: Travel[];
  selected: Travel[];
  ownerName?: string | null;
  pdfConfig?: ExportConfig;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  hasSelection: boolean;
  selectionCount: number;
  baseSettings: BookSettings;
  lastSettings: BookSettings;
  settingsSummary: string;
  setLastSettings: React.Dispatch<React.SetStateAction<BookSettings>>;
  styles: Record<string, unknown>;
};

function ListTravelExportControls({
  isMobile,
  travels,
  selected,
  ownerName,
  pdfConfig,
  toggleSelectAll,
  clearSelection,
  hasSelection,
  selectionCount,
  baseSettings,
  lastSettings,
  settingsSummary,
  setLastSettings,
  styles,
}: Props) {
  const pdfExport = usePdfExport(selected, pdfConfig);
  const [isBookSettingsOpen, setIsBookSettingsOpen] = useState(false);

  const handleCloseSettings = useCallback(() => {
    setIsBookSettingsOpen(false);
  }, []);

  const handleImmediateSave = useCallback(() => {
    void pdfExport.openPrintBook(lastSettings);
  }, [lastSettings, pdfExport]);

  const handleOpenSettings = useCallback(() => {
    setIsBookSettingsOpen(true);
  }, []);

  const handleSaveWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.openPrintBook(settings);
    },
    [pdfExport, setLastSettings],
  );

  const handlePreviewWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings);
      await pdfExport.openPrintBook(settings);
    },
    [pdfExport, setLastSettings],
  );

  const userName = useMemo(() => String(ownerName || ''), [ownerName]);

  return (
    <>
      <BookSettingsModal
        visible={isBookSettingsOpen}
        onClose={handleCloseSettings}
        onSave={handleSaveWithSettings}
        onPreview={handlePreviewWithSettings}
        defaultSettings={lastSettings || baseSettings}
        travelCount={selectionCount}
        userName={userName}
        mode="save"
      />

      <ExportBar
        isMobile={isMobile}
        selectedCount={selectionCount}
        allCount={travels.length}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={clearSelection}
        onSave={handleImmediateSave}
        onSettings={handleOpenSettings}
        isGenerating={pdfExport.isGenerating}
        progress={pdfExport.progress}
        settingsSummary={settingsSummary}
        hasSelection={hasSelection}
        styles={styles as ExportBarStyles}
      />
    </>
  );
}

export default React.memo(ListTravelExportControls);
