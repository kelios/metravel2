// src/hooks/usePdfExport.ts
// ✅ АРХИТЕКТУРА: React hook для экспорта в PDF

import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { PdfExportService } from '@/src/services/pdf-export/PdfExportService';
import { Html2PdfRenderer } from '@/src/renderers/pdf/Html2PdfRenderer';
import { ExportProgress, ExportStage, ExportConfig } from '@/src/types/pdf-export';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travels';

/**
 * React hook для экспорта путешествий в PDF
 * Тонкий слой над PdfExportService
 */
export function usePdfExport(selected: Travel[], config?: ExportConfig) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [currentStage, setCurrentStage] = useState<ExportStage>(ExportStage.VALIDATING);

  const serviceRef = useRef<PdfExportService | null>(null);
  const travelCacheRef = useRef<Record<string | number, Travel>>({});

  // Инициализируем сервис один раз
  useEffect(() => {
    const canUseDom = typeof document !== 'undefined';
    if ((Platform.OS === 'web' || canUseDom) && !serviceRef.current) {
      const renderer = new Html2PdfRenderer();
      serviceRef.current = new PdfExportService(renderer, config);
    }

    return () => {
      // Cleanup при размонтировании
      serviceRef.current = null;
    };
  }, [config]);

  /**
   * Callback для обновления прогресса
   */
  const handleProgress = useCallback((progress: ExportProgress) => {
    setProgress(progress.progress);
    setCurrentStage(progress.stage);
  }, []);

  const needsDetails = useCallback((travel: Travel) => {
    const partial = travel as Partial<Travel>;
    return (
      typeof partial.description === 'undefined' ||
      typeof partial.recommendation === 'undefined' ||
      typeof partial.plus === 'undefined' ||
      typeof partial.minus === 'undefined' ||
      typeof partial.gallery === 'undefined' ||
      typeof partial.travelAddress === 'undefined'
    );
  }, []);

  const mergeTravelData = useCallback((base: Travel, detailed: Travel): Travel => {
    return {
      ...base,
      ...detailed,
      description: detailed.description ?? base.description,
      recommendation: detailed.recommendation ?? base.recommendation,
      plus: detailed.plus ?? base.plus,
      minus: detailed.minus ?? base.minus,
      gallery: detailed.gallery ?? base.gallery,
      travelAddress: detailed.travelAddress ?? base.travelAddress,
    };
  }, []);

  const loadDetailedTravels = useCallback(async () => {
    if (!selected?.length) return [];

    const enriched = await Promise.all(
      selected.map(async (travel) => {
        const cacheKey = travel.id ?? travel.slug ?? travel.url;

        if (cacheKey && travelCacheRef.current[cacheKey]) {
          return mergeTravelData(travel, travelCacheRef.current[cacheKey]);
        }

        if (!needsDetails(travel)) {
          if (cacheKey) {
            travelCacheRef.current[cacheKey] = travel;
          }
          return travel;
        }

        try {
          const numericId = Number(travel.id);
          let detailed: Travel;

          if (!Number.isNaN(numericId)) {
            detailed = await fetchTravel(numericId);
          } else if (travel.slug) {
            detailed = await fetchTravelBySlug(travel.slug);
          } else {
            detailed = travel;
          }
          const merged = mergeTravelData(travel, detailed);
          if (cacheKey) {
            travelCacheRef.current[cacheKey] = merged;
          }
          return merged;
        } catch (error) {
          console.warn('[usePdfExport] Не удалось загрузить детали путешествия', travel.id, error);
          return travel;
        }
      })
    );

    return enriched;
  }, [selected, mergeTravelData, needsDetails]);

  /**
   * Экспортирует путешествия в PDF
   */
  const exportPdf = useCallback(async (settings: BookSettings): Promise<void> => {
    if (!serviceRef.current) {
      Alert.alert('Ошибка', 'PDF экспорт недоступен');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      const travelsForExport = await loadDetailedTravels();
      if (!travelsForExport.length) {
        Alert.alert('Внимание', 'Выберите хотя бы одно путешествие для экспорта');
        return;
      }
      const result = await serviceRef.current.export(
        travelsForExport,
        settings,
        handleProgress
      );

      // Скачиваем файл
      const link = document.createElement('a');
      link.href = URL.createObjectURL(result.blob);
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      Alert.alert('Успешно!', `PDF-фотоальбом "${settings.title}" успешно создан и сохранен`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      Alert.alert('Ошибка', error.message);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [selected, handleProgress, loadDetailedTravels]);

  /**
   * Создает превью PDF
   */
  const previewPdf = useCallback(async (settings: BookSettings): Promise<string | null> => {
    if (!serviceRef.current) {
      Alert.alert('Ошибка', 'PDF превью недоступно');
      return null;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    let container: HTMLElement | null = null;
    let iframe: HTMLIFrameElement | null = null;
    let closeBtn: HTMLButtonElement | null = null;

    try {
      const travelsForExport = await loadDetailedTravels();
      if (!travelsForExport.length) {
        Alert.alert('Внимание', 'Выберите хотя бы одно путешествие для экспорта');
        return null;
      }
      const result = await serviceRef.current.preview(
        travelsForExport,
        settings,
        handleProgress
      );

      // Контейнер будет удален сервисом при закрытии превью
      // Находим контейнер для удаления при закрытии
      const containers = document.querySelectorAll('div[style*="210mm"]');
      container = Array.from(containers)
        .filter(el => {
          const style = (el as HTMLElement).style;
          return style.width === '210mm' || style.width.includes('210mm');
        })
        .pop() as HTMLElement || null;

      // Создаем iframe для превью
      iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:9998;background:#fff;';
      iframe.src = result.blobUrl;

      // Создаем кнопку закрытия
      closeBtn = document.createElement('button');
      closeBtn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;padding:12px 24px;background:#ff9f5a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
      closeBtn.textContent = 'Закрыть';

      const cleanup = () => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        if (closeBtn && closeBtn.parentNode) {
          closeBtn.parentNode.removeChild(closeBtn);
        }
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        if (result.blobUrl) {
          URL.revokeObjectURL(result.blobUrl);
        }
        iframe = null;
        closeBtn = null;
        container = null;
      };

      closeBtn.onclick = cleanup;

      document.body.appendChild(iframe);
      document.body.appendChild(closeBtn);

      return result.blobUrl;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      Alert.alert('Ошибка', error.message);
      return null;
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  }, [selected, handleProgress, loadDetailedTravels]);

  return {
    exportPdf,
    previewPdf,
    isGenerating,
    progress,
    error,
    currentStage,
  };
}

