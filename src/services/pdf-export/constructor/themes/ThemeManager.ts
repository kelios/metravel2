// src/services/pdf-export/constructor/themes/ThemeManager.ts
// ✅ АРХИТЕКТУРА: Менеджер тем для конструктора PDF

import type { PdfTheme } from '@/src/types/pdf-constructor';
import { SimpleTheme } from './SimpleTheme';
import { LightTheme } from './LightTheme';
import { DarkTheme } from './DarkTheme';
import { MagazineTheme } from './MagazineTheme';
import { TravelBookTheme } from './TravelBookTheme';

/**
 * Менеджер тем
 */
export class ThemeManager {
  private themes: Map<string, PdfTheme> = new Map();

  constructor() {
    // Регистрируем встроенные темы
    this.registerTheme(SimpleTheme);
    this.registerTheme(LightTheme);
    this.registerTheme(DarkTheme);
    this.registerTheme(MagazineTheme);
    this.registerTheme(TravelBookTheme);
  }

  /**
   * Регистрирует тему
   */
  registerTheme(theme: PdfTheme): void {
    this.themes.set(theme.id, theme);
  }

  /**
   * Получает тему по ID
   */
  getTheme(id: string): PdfTheme | null {
    return this.themes.get(id) || null;
  }

  /**
   * Получает все темы
   */
  getAllThemes(): PdfTheme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Получает тему по умолчанию
   */
  getDefaultTheme(): PdfTheme {
    return this.getTheme('simple') || SimpleTheme;
  }
}

// Экспортируем singleton
export const themeManager = new ThemeManager();

