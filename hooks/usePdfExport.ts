// src/hooks/usePdfExport.ts
// ✅ АРХИТЕКТУРА: Тонкий React hook, тяжелый export runtime грузится только по запросу

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage, ExportConfig } from '@/types/pdf-export';

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
      runtimeModuleRef.current = import('@/hooks/usePdfExportRuntime');
    }
    return runtimeModuleRef.current;
  }, []);

  useEffect(() => {
    void loadRuntimeModule().then((mod) => {
      if (!isMountedRef.current) {
        return;
      }

      return mod.prewarmPdfExportRuntime();
    });
  }, [config, loadRuntimeModule]);

  /**
   * Открывает HTML-книгу в новом окне для печати (window.print)
   */
  const openPrintBook = useCallback(
    async (settings: BookSettings): Promise<void> => {
      const runtime = await loadRuntimeModule();
      await runtime.runPdfExport({
        selected,
        settings,
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
