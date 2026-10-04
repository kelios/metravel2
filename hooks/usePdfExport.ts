// src/hooks/usePdfExport.ts
// ✅ АРХИТЕКТУРА: Тонкий React hook, тяжелый export runtime грузится только по запросу

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage, ExportConfig } from '@/types/pdf-export';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { beginPrint } from '@/utils/printHtml';
import { showToast } from '@/utils/toast';
import { translate as i18nT } from '@/i18n';

/**
 * React hook для экспорта путешествий в PDF
 * Тонкий слой над lazy runtime модулем экспорта
 */
export function usePdfExport(selected: Travel[], config?: ExportConfig) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [currentStage, setCurrentStage] = useState<ExportStage>(ExportStage.VALIDATING);
  const [message, setMessage] = useState<string>('');
  const [substeps, setSubsteps] = useState<string[]>([]);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | undefined>();

  const travelCacheRef = useRef<Record<string | number, Travel>>({});
  const runtimeModuleRef = useRef<Promise<typeof import('@/hooks/usePdfExportRuntime')> | null>(null);

  // ✅ ИСПРАВЛЕНИЕ: Флаг для отслеживания монтирования компонента
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Callback для обновления прогресса
   */
  /**
   * Обновить прогресс с подэтапами
   */
  const updateProgress = useCallback((
    stage: ExportStage,
    progressValue: number,
    messageText?: string,
    substepsList?: string[],
    timeRemaining?: number
  ) => {
    if (isMountedRef.current) {
      setCurrentStage(stage);
      setProgress(progressValue);
      if (messageText) setMessage(messageText);
      if (substepsList) setSubsteps(substepsList);
      if (timeRemaining !== undefined) setEstimatedTimeRemaining(timeRemaining);
    }
  }, []);

  const loadRuntimeModule = useCallback(() => {
    if (!runtimeModuleRef.current) {
      runtimeModuleRef.current = Promise.resolve(import('@/hooks/usePdfExportRuntime'));
    }
    return runtimeModuleRef.current;
  }, []);

  /**
   * Открывает HTML-книгу в окне печати. #2125: единственное место резерва окна
   * для всех входов в книгу — beginPrint() стоит до первого await, иначе
   * блокировщик всплывающих окон отменит окно, открытое после генерации.
   */
  const openPrintBook = useCallback(
    async (settings: BookSettings): Promise<void> => {
      const printSession = beginPrint();
      if (!printSession.available) {
        // Окно заблокировано — книгу не собираем впустую, причину показываем сразу.
        void showToast({ type: 'error', text1: i18nT('common:print.unavailable'), position: 'bottom' });
        return;
      }
      queueAnalyticsEvent('PDF_Export', {
        travelsCount: Array.isArray(selected) ? selected.length : 0,
        template: settings?.template,
      });
      let runtime: typeof import('@/hooks/usePdfExportRuntime');
      try {
        runtime = await loadRuntimeModule();
      } catch {
        runtimeModuleRef.current = null;
        printSession.cancel();
        void showToast({
          type: 'error',
          text1: i18nT('export:hooks.usePdfExportRuntime.predprosmotr_knigi_nedostupen_7f86d03a'),
          position: 'bottom',
        });
        return;
      }
      await runtime.runPdfExport({
        selected,
        settings,
        printSession,
        config,
        travelCacheRef,
        isMountedRef,
        setIsGenerating,
        setError,
        setCurrentStage,
        updateProgress,
      });
    },
    [config, loadRuntimeModule, selected, updateProgress],
  );

  return useMemo(() => ({
    openPrintBook,
    isGenerating,
    progress,
    error,
    currentStage,
    message,
    substeps,
    estimatedTimeRemaining,
  }), [openPrintBook, isGenerating, progress, error, currentStage, message, substeps, estimatedTimeRemaining]);
}
