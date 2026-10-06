// src/hooks/usePdfExport.ts
// ✅ АРХИТЕКТУРА: Тонкий React hook, тяжелый export runtime грузится только по запросу

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage, ExportConfig } from '@/types/pdf-export';
import { queueAnalyticsEvent } from '@/utils/analytics';
import { beginPrint } from '@/utils/printHtml';
import type { PrintSession } from '@/utils/printHtml';
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
  /** #2274: текущая сборка — её отменяет `cancel`, обновления прежних сборок не доходят до стейта. */
  const activeRunRef = useRef<{ controller: AbortController; printSession: PrintSession } | null>(null);

  // ✅ ИСПРАВЛЕНИЕ: Флаг для отслеживания монтирования компонента
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const run = activeRunRef.current;
      activeRunRef.current = null;
      run?.controller.abort();
      run?.printSession.cancel();
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
      const previous = activeRunRef.current;
      activeRunRef.current = null;
      previous?.controller.abort();
      previous?.printSession.cancel();
      const printSession = beginPrint();
      if (!printSession.available) {
        // Окно заблокировано — книгу не собираем впустую, причину показываем сразу.
        void showToast({ type: 'error', text1: i18nT('common:print.unavailable'), position: 'bottom' });
        return;
      }
      const controller = new AbortController();
      activeRunRef.current = { controller, printSession };
      setIsGenerating(true);
      setError(null);
      const isCurrentRun = () => activeRunRef.current?.controller === controller;
      const onPreparationStopped = () => {
        if (!isCurrentRun()) return;
        // RN's AbortController polyfill has no signal.reason. A default abort
        // may be runtime cleanup; only an explicit deadline error owns state.
        const preparationError = printSession.getPreparationError?.();
        if (!preparationError) return;
        activeRunRef.current = null;
        controller.abort();
        printSession.cancel();
        if (!isMountedRef.current) return;
        setIsGenerating(false);
        setError(preparationError);
        setCurrentStage(ExportStage.ERROR);
        void showToast({ type: 'error', text1: preparationError.message, position: 'bottom' });
      };
      printSession.preparationSignal?.addEventListener('abort', onPreparationStopped, { once: true });
      const untilStopped = async <T,>(work: Promise<T>): Promise<T | undefined> => {
        let stop: () => void = () => {};
        const stopped = new Promise<undefined>((resolve) => { stop = () => resolve(undefined); });
        controller.signal.addEventListener('abort', stop, { once: true });
        if (controller.signal.aborted) stop();
        try { return await Promise.race([work, stopped]); }
        finally { controller.signal.removeEventListener('abort', stop); }
      };
      const onlyCurrent = <Args extends unknown[]>(apply: (...args: Args) => void) =>
        (...args: Args) => {
          if (isCurrentRun()) apply(...args);
        };
      queueAnalyticsEvent('PDF_Export', {
        travelsCount: Array.isArray(selected) ? selected.length : 0,
        template: settings?.template,
      });
      let runtime: typeof import('@/hooks/usePdfExportRuntime') | undefined;
      try {
        runtime = await untilStopped(loadRuntimeModule());
      } catch {
        runtimeModuleRef.current = null;
        const current = isCurrentRun();
        if (current) activeRunRef.current = null;
        printSession.preparationSignal?.removeEventListener('abort', onPreparationStopped);
        printSession.cancel();
        if (!current) return;
        setIsGenerating(false);
        void showToast({
          type: 'error',
          text1: i18nT('export:hooks.usePdfExportRuntime.predprosmotr_knigi_nedostupen_7f86d03a'),
          position: 'bottom',
        });
        return;
      }
      if (!isCurrentRun() || !runtime) {
        printSession.preparationSignal?.removeEventListener('abort', onPreparationStopped);
        return;
      }
      try {
        await untilStopped(runtime.runPdfExport({
          selected,
          settings,
          printSession,
          signal: controller.signal,
          config,
          travelCacheRef,
          isMountedRef,
          setIsGenerating: onlyCurrent(setIsGenerating),
          setError: onlyCurrent(setError),
          setCurrentStage: onlyCurrent(setCurrentStage),
          updateProgress: onlyCurrent(updateProgress),
        }));
      } finally {
        printSession.preparationSignal?.removeEventListener('abort', onPreparationStopped);
        if (isCurrentRun()) activeRunRef.current = null;
      }
    },
    [config, loadRuntimeModule, selected, updateProgress],
  );

  /**
   * #2274: «Отмена» на время сборки — прогресс сбрасывается сразу, печать не
   * запускается позже, ошибки и тостов нет. Без идущей сборки ничего не делает.
   */
  const cancel = useCallback(() => {
    const run = activeRunRef.current;
    if (!run) return;
    activeRunRef.current = null;
    run.controller.abort();
    run.printSession.cancel();
    if (!isMountedRef.current) return;
    setIsGenerating(false);
    setProgress(0);
    setError(null);
    setCurrentStage(ExportStage.VALIDATING);
    setMessage('');
    setSubsteps([]);
    setEstimatedTimeRemaining(undefined);
  }, []);

  return useMemo(() => ({
    openPrintBook,
    cancel,
    isGenerating,
    progress,
    error,
    currentStage,
    message,
    substeps,
    estimatedTimeRemaining,
  }), [openPrintBook, cancel, isGenerating, progress, error, currentStage, message, substeps, estimatedTimeRemaining]);
}
