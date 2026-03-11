import React, { Suspense, lazy, useCallback, useEffect } from 'react';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import * as useSingleTravelExportModule from '@/components/travel/hooks/useSingleTravelExport';
import { ExportStage } from '@/types/pdf-export';
import { resolveExportedFunction } from '@/utils/moduleInterop';

const BookSettingsModalLazy = lazy(() => import('@/components/export/BookSettingsModal'));

const FALLBACK_BOOK_SETTINGS: BookSettings = {
  title: 'Мои путешествия',
  subtitle: '',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  includeChecklists: false,
  checklistSections: ['clothing', 'food', 'electronics'],
};

const fallbackUseSingleTravelExport: typeof useSingleTravelExportModule.useSingleTravelExport = () => ({
  pdfExport: {
    isGenerating: false,
    progress: 0,
    currentStage: ExportStage.ERROR,
  } as any,
  lastSettings: FALLBACK_BOOK_SETTINGS,
  settingsSummary: 'minimal',
  handleOpenPrintBookWithSettings: async () => {},
});

const useSingleTravelExportSafe =
  resolveExportedFunction<typeof useSingleTravelExportModule.useSingleTravelExport>(
    useSingleTravelExportModule as unknown as Record<string, unknown>,
    'useSingleTravelExport',
  ) ?? fallbackUseSingleTravelExport;

export type ShareButtonsPdfExportState = {
  isGenerating: boolean;
  progress: number;
  currentStage: ExportStage;
  lastSettings: BookSettings;
};

type Props = {
  travel: Travel;
  visible: boolean;
  onClose: () => void;
  onStateChange: (state: ShareButtonsPdfExportState) => void;
};

function ShareButtonsPdfExportBridge({ travel, visible, onClose, onStateChange }: Props) {
  const { pdfExport, lastSettings, handleOpenPrintBookWithSettings } = useSingleTravelExportSafe(travel);
  const { isGenerating, progress, currentStage } = pdfExport;

  useEffect(() => {
    onStateChange({
      isGenerating: Boolean(isGenerating),
      progress: progress ?? 0,
      currentStage: currentStage ?? ExportStage.ERROR,
      lastSettings,
    });
  }, [currentStage, isGenerating, lastSettings, onStateChange, progress]);

  const handleExport = useCallback(
    async (settings: BookSettings) => {
      await handleOpenPrintBookWithSettings(settings);
      onClose();
    },
    [handleOpenPrintBookWithSettings, onClose],
  );

  return (
    <Suspense fallback={null}>
      <BookSettingsModalLazy
        visible={visible}
        onClose={onClose}
        onSave={handleExport}
        onPreview={handleExport}
        travelCount={1}
        defaultSettings={lastSettings}
        userName={travel.userName || undefined}
        mode="preview"
      />
    </Suspense>
  );
}

export default React.memo(ShareButtonsPdfExportBridge);
