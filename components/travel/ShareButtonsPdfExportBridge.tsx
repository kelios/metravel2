import React, { Suspense, lazy, useCallback, useEffect } from 'react';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import * as useSingleTravelExportModule from '@/components/travel/hooks/useSingleTravelExport';
import { ExportStage } from '@/types/pdf-export';
import { resolveExportedFunction } from '@/utils/moduleInterop';
import { translate as i18nT } from '@/i18n'

const BookSettingsModalLazy = lazy(() => import('@/components/export/BookSettingsModal'));

const FALLBACK_BOOK_SETTINGS: BookSettings = {
  get title() { return i18nT('travel:components.travel.pdfExport.defaultBookTitle') },
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
    cancel: () => {},
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
  /** #2274: «Отмена» на время сборки; без идущей сборки ничего не делает. */
  cancel?: () => void;
};

type Props = {
  travel: Travel;
  visible: boolean;
  onClose: () => void;
  onStateChange: (state: ShareButtonsPdfExportState) => void;
};

function ShareButtonsPdfExportBridge({ travel, visible, onClose, onStateChange }: Props) {
  const { pdfExport, lastSettings, handleOpenPrintBookWithSettings } = useSingleTravelExportSafe(travel);
  const { isGenerating, progress, currentStage, cancel } = pdfExport;

  useEffect(() => {
    onStateChange({
      isGenerating: Boolean(isGenerating),
      progress: progress ?? 0,
      currentStage: currentStage ?? ExportStage.ERROR,
      lastSettings,
      cancel,
    });
  }, [cancel, currentStage, isGenerating, lastSettings, onStateChange, progress]);

  const handleCloseSettings = useCallback(() => {
    // Also covers native Modal dismissal while its async Save is pending.
    cancel();
    onClose();
  }, [cancel, onClose]);

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
        onClose={handleCloseSettings}
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
