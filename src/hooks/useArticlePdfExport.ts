// src/hooks/useArticlePdfExport.ts
// React hook для экспорта одной статьи путешествия в PDF (HTML-превью)

import { useState, useCallback } from 'react';
import type { Travel } from '@/src/types/types';
import { ArticlePdfExportService } from '@/src/services/pdf-export/ArticlePdfExportService';
import type { ArticleExportSettings } from '@/src/services/pdf-export/generators/ArticlePdfGenerator';
import {
  ARTICLE_EXPORT_PRESETS,
  type ArticleExportPresetId,
} from '@/src/services/pdf-export/ArticleExportPresets';
import { openBookPreviewWindow } from '@/src/utils/openBookPreviewWindow';

export interface UseArticlePdfExportOptions {
  defaultPresetId?: ArticleExportPresetId;
}

export interface UseArticlePdfExportResult {
  exportArticle: (travel: Travel, overrides?: Partial<ArticleExportSettings>) => Promise<void>;
  isGenerating: boolean;
  progress: number;
  error: Error | null;
}

export function useArticlePdfExport(
  options: UseArticlePdfExportOptions = {}
): UseArticlePdfExportResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const defaultPresetId: ArticleExportPresetId = options.defaultPresetId || 'default';
  const service = new ArticlePdfExportService();

  const exportArticle = useCallback(
    async (travel: Travel, overrides: Partial<ArticleExportSettings> = {}) => {
      if (typeof window === 'undefined') {
        return;
      }

      setIsGenerating(true);
      setError(null);
      setProgress(0);

      try {
        const preset = ARTICLE_EXPORT_PRESETS[defaultPresetId];
        const baseSettings = preset.settings;
        const settings: ArticleExportSettings = {
          ...baseSettings,
          ...overrides,
        };

        setProgress(20);
        const html = service.generateHtml(travel, settings);
        setProgress(70);

        openBookPreviewWindow(html);
        setProgress(100);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setProgress(0);
      } finally {
        setIsGenerating(false);
      }
    },
    [defaultPresetId, service]
  );

  return {
    exportArticle,
    isGenerating,
    progress,
    error,
  };
}
