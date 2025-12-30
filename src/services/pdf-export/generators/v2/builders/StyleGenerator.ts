// src/services/pdf-export/generators/v2/builders/StyleGenerator.ts
// ✅ ГЕНЕРАТОР: Генерация CSS стилей на основе темы

import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig';

/**
 * Генератор стилей для PDF
 */
export class StyleGenerator {
  constructor(private theme: PdfThemeConfig) {}

  /**
   * Генерирует стиль для заголовка
   */
  heading(level: 1 | 2 | 3 | 4): string {
    const config = this.theme.typography[`h${level}` as keyof typeof this.theme.typography];
    if (!config || typeof config === 'string') {
      return this.defaultHeading(level);
    }

    return `
      font-size: ${config.size};
      font-weight: ${config.weight};
      line-height: ${config.lineHeight};
      color: ${this.theme.colors.text};
      margin: ${this.getHeadingMargin(level)};
    `.trim();
  }

  /**
   * Генерирует стиль для параграфа
   */
  paragraph(): string {
    const { body } = this.theme.typography;
    return `
      font-size: ${body.size};
      font-weight: ${body.weight};
      line-height: ${body.lineHeight};
      color: ${this.theme.colors.text};
      margin: 0 0 1em 0;
    `.trim();
  }

  /**
   * Генерирует стиль для секции
   */
  section(padding = '20px'): string {
    return `
      padding: ${padding};
      background: ${this.theme.colors.surface || '#fff'};
    `.trim();
  }

  /**
   * Генерирует стиль для страницы
   */
  page(): string {
    return `
      width: 100%;
      min-height: 100vh;
      background: ${this.theme.colors.background};
      color: ${this.theme.colors.text};
      font-family: ${this.theme.typography.fontFamily};
      page-break-after: always;
      position: relative;
    `.trim();
  }

  /**
   * Генерирует стиль для кнопки/элемента действия
   */
  button(): string {
    return `
      background: ${this.theme.colors.primary};
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    `.trim();
  }

  /**
   * Генерирует стиль для карточки
   */
  card(): string {
    return `
      background: ${this.theme.colors.surface || '#fff'};
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `.trim();
  }

  /**
   * Генерирует полный CSS для документа
   */
  generateGlobalStyles(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: ${this.theme.typography.fontFamily};
        background: ${this.theme.colors.background};
        color: ${this.theme.colors.text};
        line-height: 1.6;
      }
      
      h1 { ${this.heading(1)} }
      h2 { ${this.heading(2)} }
      h3 { ${this.heading(3)} }
      h4 { ${this.heading(4)} }
      
      p { ${this.paragraph()} }
      
      .page { ${this.page()} }
      .section { ${this.section()} }
      .card { ${this.card()} }
      .button { ${this.button()} }
      
      img {
        max-width: 100%;
        height: auto;
        display: block;
      }
    `.trim();
  }

  /**
   * Стиль по умолчанию для заголовка
   */
  private defaultHeading(level: number): string {
    const sizes = ['32px', '28px', '24px', '20px'];
    return `
      font-size: ${sizes[level - 1] || '20px'};
      font-weight: 700;
      line-height: 1.2;
      color: ${this.theme.colors.text};
      margin: ${this.getHeadingMargin(level)};
    `.trim();
  }

  /**
   * Отступы для заголовков
   */
  private getHeadingMargin(level: number): string {
    const margins = ['2em 0 1em', '1.5em 0 0.75em', '1.2em 0 0.6em', '1em 0 0.5em'];
    return margins[level - 1] || '1em 0 0.5em';
  }
}

