// src/services/pdf-export/generators/pages/CoverPageGenerator.ts
// Legacy compatibility adapter for the old pages/* API.

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import { generateSharedCoverPageMarkup, type SharedCoverPageData } from '../v2/runtime/coverPage';

export interface CoverPageData {
  title: string;
  subtitle?: string;
  userName: string;
  travelCount: number;
  yearRange?: string;
  coverImage?: string;
  quote?: {
    text: string;
    author: string;
  };
  // Опциональные параметры для кастомизации
  textPosition?: 'top' | 'center' | 'bottom' | 'auto';
  overlayOpacity?: number;
  showDecorations?: boolean;
}

export class CoverPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  async generate(data: CoverPageData): Promise<string> {
    return generateSharedCoverPageMarkup(this.theme, {
      ...(data as SharedCoverPageData),
      coverImage: data.coverImage || undefined,
    });
  }
}
