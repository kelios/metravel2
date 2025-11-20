// src/services/pdf-export/generators/ArticlePdfGenerator.ts
// ✅ АРХИТЕКТУРА: Генератор HTML для PDF одной статьи путешествия

import type { ArticlePdfModel, Section } from '@/src/types/article-pdf';
import type { PdfThemeConfig } from '../themes/PdfThemeConfig';
import { getThemeConfig } from '../themes/PdfThemeConfig';

/**
 * Настройки экспорта статьи
 */
export interface ArticleExportSettings {
  theme: 'simple' | 'light' | 'dark' | 'magazine';
  format: 'A4' | 'Letter' | 'A5';
  includeToc: boolean;
  includeMap: boolean;
  includeRecommendations: boolean;
  language?: 'ru' | 'en';
}

/**
 * Генератор HTML для PDF одной статьи
 */
export class ArticlePdfGenerator {
  private theme: PdfThemeConfig;

  constructor(themeName: ArticleExportSettings['theme'] = 'light') {
    // Маппим названия тем
    const themeMap: Record<string, string> = {
      simple: 'minimal',
      light: 'light',
      dark: 'dark',
      magazine: 'travel-magazine',
    };
    
    this.theme = getThemeConfig(themeMap[themeName] || 'light');
  }

  /**
   * Генерирует HTML для PDF
   */
  generate(model: ArticlePdfModel, settings: ArticleExportSettings): string {
    const format = this.getFormatSize(settings.format);
    
    // Проверяем, что есть контент
    const hasContent = model.sections && model.sections.length > 0;
    if (!hasContent) {
      console.warn('[ArticlePdfGenerator] No sections found in model, adding fallback content');
    }
    
    const html = `
<!DOCTYPE html>
<html lang="${settings.language || 'ru'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(model.title)}</title>
  <style>
    ${this.generateStyles(format)}
  </style>
</head>
<body>
  ${this.generateCoverPage(model)}
  ${settings.includeToc ? this.generateTocPage(model) : ''}
  ${this.generateInfoCard(model)}
  ${hasContent ? this.generateContent(model, settings) : this.generateFallbackContent(model)}
  ${settings.includeMap && model.map ? this.generateMapPage(model.map) : ''}
  ${settings.includeRecommendations && model.recommendations ? this.generateRecommendationsPage(model.recommendations) : ''}
  ${this.generateBackCover(model)}
</body>
</html>`;

    return html;
  }

  /**
   * Генерирует fallback контент, если секции отсутствуют
   */
  private generateFallbackContent(model: ArticlePdfModel): string {
    return `
    <div class="pdf-page">
      <h2>${this.escapeHtml(model.title)}</h2>
      <p>К сожалению, контент статьи не удалось извлечь. Возможно, статья еще не содержит описания или произошла ошибка при обработке.</p>
      ${model.meta.country ? `<p><strong>Страна:</strong> ${this.escapeHtml(model.meta.country)}</p>` : ''}
      ${model.meta.region ? `<p><strong>Регион:</strong> ${this.escapeHtml(model.meta.region)}</p>` : ''}
      ${model.meta.days ? `<p><strong>Длительность:</strong> ${model.meta.days} дней</p>` : ''}
    </div>`;
  }

  /**
   * Генерирует стили
   */
  private generateStyles(format: { width: string; height: string }): string {
    const { colors, typography, spacing, blocks } = this.theme;

    return `
    @page {
      size: ${format.width} ${format.height};
      margin: ${spacing.pagePadding};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    body {
      font-family: ${typography.bodyFont};
      font-size: ${typography.body.size};
      line-height: ${typography.body.lineHeight};
      color: ${colors.text};
      background: ${colors.background};
      margin: 0;
      padding: 0;
    }

    .pdf-page {
      width: 100%;
      min-height: 100vh;
      page-break-after: always;
      page-break-inside: avoid;
      padding: ${spacing.pagePadding};
      background: ${colors.background};
      display: block;
      position: relative;
      overflow: visible;
    }

    .pdf-page:last-child {
      page-break-after: auto;
    }

    /* Обложка */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, ${this.theme.colors.cover.backgroundGradient[0]}, ${this.theme.colors.cover.backgroundGradient[1]});
      color: ${this.theme.colors.cover.text};
      position: relative;
      overflow: hidden;
    }

    .cover-image {
      width: 100%;
      max-height: 60vh;
      object-fit: cover;
      border-radius: ${blocks.borderRadius};
      box-shadow: ${blocks.shadow};
      margin-bottom: ${spacing.blockSpacing};
    }

    .cover-title {
      font-family: ${typography.headingFont};
      font-size: ${typography.h1.size};
      font-weight: ${typography.h1.weight};
      line-height: ${typography.h1.lineHeight};
      text-align: center;
      margin-bottom: ${typography.h1.marginBottom};
      color: ${this.theme.colors.cover.text};
    }

    .cover-subtitle {
      font-size: ${typography.h3.size};
      text-align: center;
      color: ${this.theme.colors.cover.textSecondary};
      margin-bottom: ${spacing.sectionSpacing};
    }

    .cover-author {
      font-size: ${typography.body.size};
      text-align: center;
      color: ${this.theme.colors.cover.textSecondary};
      margin-top: auto;
    }

    .cover-logo {
      margin-top: ${spacing.sectionSpacing};
      font-size: ${typography.h4.size};
      font-weight: ${typography.h4.weight};
      color: ${this.theme.colors.cover.text};
    }

    /* Оглавление */
    .toc-page {
      display: flex;
      flex-direction: column;
    }

    .toc-title {
      font-family: ${typography.headingFont};
      font-size: ${typography.h1.size};
      font-weight: ${typography.h1.weight};
      margin-bottom: ${spacing.sectionSpacing};
      color: ${colors.text};
    }

    .toc-item {
      display: flex;
      justify-content: space-between;
      padding: ${spacing.elementSpacing} 0;
      border-bottom: 1px solid ${colors.borderLight};
      text-decoration: none;
      color: ${colors.text};
    }

    .toc-item:hover {
      color: ${colors.accent};
    }

    .toc-item-number {
      font-weight: ${typography.h4.weight};
      color: ${colors.accent};
    }

    /* Инфокарта */
    .info-card {
      background: ${colors.surface};
      border: ${blocks.borderWidth} solid ${colors.border};
      border-radius: ${blocks.borderRadius};
      padding: ${spacing.blockSpacing};
      margin-bottom: ${spacing.sectionSpacing};
      box-shadow: ${blocks.shadow};
    }

    .info-card-title {
      font-family: ${typography.headingFont};
      font-size: ${typography.h2.size};
      font-weight: ${typography.h2.weight};
      margin-bottom: ${spacing.blockSpacing};
      color: ${colors.text};
    }

    .info-card-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: ${spacing.elementSpacing};
    }

    .info-card-item {
      display: flex;
      flex-direction: column;
    }

    .info-card-label {
      font-size: ${typography.small.size};
      color: ${colors.textMuted};
      margin-bottom: 4pt;
    }

    .info-card-value {
      font-size: ${typography.body.size};
      font-weight: 600;
      color: ${colors.text};
    }

    /* Контент */
    .content-section {
      margin-bottom: ${spacing.sectionSpacing};
      page-break-inside: avoid;
    }

    h2 {
      font-family: ${typography.headingFont};
      font-size: ${typography.h2.size};
      font-weight: ${typography.h2.weight};
      line-height: ${typography.h2.lineHeight};
      margin-bottom: ${typography.h2.marginBottom};
      margin-top: ${spacing.sectionSpacing};
      color: ${colors.text};
      page-break-after: avoid;
    }

    h3 {
      font-family: ${typography.headingFont};
      font-size: ${typography.h3.size};
      font-weight: ${typography.h3.weight};
      line-height: ${typography.h3.lineHeight};
      margin-bottom: ${typography.h3.marginBottom};
      margin-top: ${spacing.blockSpacing};
      color: ${colors.text};
      page-break-after: avoid;
    }

    p {
      font-size: ${typography.body.size};
      line-height: ${typography.body.lineHeight};
      margin-bottom: ${typography.body.marginBottom};
      color: ${colors.text} !important;
      text-align: justify;
      display: block;
      visibility: visible;
      opacity: 1;
    }

    ul, ol {
      margin-left: ${spacing.blockSpacing};
      margin-bottom: ${typography.body.marginBottom};
      padding-left: ${spacing.blockSpacing};
    }

    li {
      margin-bottom: ${spacing.elementSpacing};
      line-height: ${typography.body.lineHeight};
    }

    /* Изображения */
    .content-image {
      width: 100%;
      max-width: 100%;
      height: auto;
      border-radius: ${blocks.borderRadius};
      margin: ${spacing.blockSpacing} 0;
      box-shadow: ${blocks.shadow};
      page-break-inside: avoid;
    }

    .image-caption {
      font-size: ${typography.caption.size};
      color: ${colors.textMuted};
      text-align: center;
      margin-top: ${spacing.elementSpacing};
      font-style: italic;
    }

    .image-gallery {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: ${spacing.elementSpacing};
      margin: ${spacing.blockSpacing} 0;
      page-break-inside: avoid;
    }

    .image-gallery img {
      width: 100%;
      height: auto;
      border-radius: ${blocks.borderRadius};
      box-shadow: ${blocks.shadow};
    }

    /* Спецблоки */
    .info-block {
      padding: ${spacing.blockSpacing};
      border-radius: ${blocks.borderRadius};
      border-left: 4px solid;
      margin: ${spacing.blockSpacing} 0;
      page-break-inside: avoid;
    }

    .info-block.tip {
      background: ${colors.tipBlock.background};
      border-color: ${colors.tipBlock.border};
      color: ${colors.tipBlock.text};
    }

    .info-block.important {
      background: ${colors.infoBlock.background};
      border-color: ${colors.infoBlock.border};
      color: ${colors.infoBlock.text};
    }

    .info-block.warning {
      background: ${colors.warningBlock.background};
      border-color: ${colors.warningBlock.border};
      color: ${colors.warningBlock.text};
    }

    .info-block-title {
      font-weight: ${typography.h4.weight};
      font-size: ${typography.h4.size};
      margin-bottom: ${spacing.elementSpacing};
    }

    blockquote {
      border-left: 4px solid ${colors.accent};
      padding-left: ${spacing.blockSpacing};
      margin: ${spacing.blockSpacing} 0;
      font-style: italic;
      color: ${colors.textSecondary};
      page-break-inside: avoid;
    }

    /* Карта */
    .map-page {
      display: flex;
      flex-direction: column;
    }

    .map-image {
      width: 100%;
      max-height: 60vh;
      object-fit: contain;
      border-radius: ${blocks.borderRadius};
      margin: ${spacing.blockSpacing} 0;
      box-shadow: ${blocks.shadow};
    }

    .map-points {
      margin-top: ${spacing.blockSpacing};
    }

    .map-point {
      padding: ${spacing.elementSpacing};
      border-bottom: 1px solid ${colors.borderLight};
    }

    .map-point-name {
      font-weight: ${typography.h4.weight};
      color: ${colors.text};
    }

    .map-point-coords {
      font-size: ${typography.small.size};
      color: ${colors.textMuted};
    }

    /* Рекомендации */
    .recommendations-list {
      list-style: none;
      margin-left: 0;
    }

    .recommendations-list li {
      padding: ${spacing.elementSpacing};
      border-left: 3px solid ${colors.accent};
      margin-bottom: ${spacing.elementSpacing};
      background: ${colors.surfaceAlt};
      border-radius: ${blocks.borderRadius};
    }

    /* Задняя обложка */
    .back-cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: ${colors.surface};
    }

    .back-cover-logo {
      font-size: ${typography.h2.size};
      font-weight: ${typography.h2.weight};
      margin-bottom: ${spacing.sectionSpacing};
      color: ${colors.accent};
    }

    .back-cover-url {
      font-size: ${typography.body.size};
      color: ${colors.textSecondary};
      margin-bottom: ${spacing.blockSpacing};
    }

    .back-cover-disclaimer {
      font-size: ${typography.small.size};
      color: ${colors.textMuted};
      margin-top: ${spacing.sectionSpacing};
      max-width: 80%;
    }
  `;
  }

  /**
   * Генерирует обложку
   */
  private generateCoverPage(model: ArticlePdfModel): string {
    const coverImage = model.coverImage
      ? `<img src="${this.escapeHtml(model.coverImage.url)}" alt="${this.escapeHtml(model.coverImage.alt || '')}" class="cover-image" />`
      : '';

    return `
    <div class="pdf-page cover-page">
      ${coverImage}
      <div>
        <h1 class="cover-title">${this.escapeHtml(model.title)}</h1>
        ${model.subtitle ? `<p class="cover-subtitle">${this.escapeHtml(model.subtitle)}</p>` : ''}
      </div>
      <div>
        ${model.author ? `<p class="cover-author">${this.escapeHtml(model.author)}</p>` : ''}
        <p class="cover-logo">MeTravel</p>
      </div>
    </div>`;
  }

  /**
   * Генерирует оглавление
   */
  private generateTocPage(model: ArticlePdfModel): string {
    const headings = model.sections.filter((s) => s.type === 'heading' && s.level === 2);
    
    if (headings.length === 0) {
      return '';
    }

    const tocItems = headings
      .map((heading, index) => {
        if (heading.type === 'heading') {
          return `
        <a href="#section-${index}" class="toc-item">
          <span>${this.escapeHtml(heading.text)}</span>
          <span class="toc-item-number">${index + 1}</span>
        </a>`;
        }
        return '';
      })
      .join('');

    return `
    <div class="pdf-page toc-page">
      <h1 class="toc-title">Оглавление</h1>
      ${tocItems}
    </div>`;
  }

  /**
   * Генерирует инфокарту
   */
  private generateInfoCard(model: ArticlePdfModel): string {
    const { meta } = model;
    const items: string[] = [];

    if (meta.country) items.push(`<div class="info-card-item"><span class="info-card-label">Страна</span><span class="info-card-value">${this.escapeHtml(meta.country)}</span></div>`);
    if (meta.region) items.push(`<div class="info-card-item"><span class="info-card-label">Регион</span><span class="info-card-value">${this.escapeHtml(meta.region)}</span></div>`);
    if (meta.distanceKm) items.push(`<div class="info-card-item"><span class="info-card-label">Длина маршрута</span><span class="info-card-value">${meta.distanceKm} км</span></div>`);
    if (meta.days) items.push(`<div class="info-card-item"><span class="info-card-label">Длительность</span><span class="info-card-value">${meta.days} ${this.pluralize(meta.days, 'день', 'дня', 'дней')}</span></div>`);
    if (meta.difficulty) items.push(`<div class="info-card-item"><span class="info-card-label">Сложность</span><span class="info-card-value">${this.escapeHtml(meta.difficulty)}</span></div>`);
    if (meta.season) items.push(`<div class="info-card-item"><span class="info-card-label">Сезон</span><span class="info-card-value">${this.escapeHtml(meta.season)}</span></div>`);
    if (meta.ascent) items.push(`<div class="info-card-item"><span class="info-card-label">Набор высоты</span><span class="info-card-value">${meta.ascent} м</span></div>`);
    if (meta.format) items.push(`<div class="info-card-item"><span class="info-card-label">Формат</span><span class="info-card-value">${this.escapeHtml(meta.format)}</span></div>`);

    if (items.length === 0) {
      return '';
    }

    return `
    <div class="pdf-page">
      <div class="info-card">
        <h2 class="info-card-title">Информация о маршруте</h2>
        <div class="info-card-grid">
          ${items.join('')}
        </div>
      </div>
    </div>`;
  }

  /**
   * Генерирует основной контент
   */
  private generateContent(model: ArticlePdfModel, settings: ArticleExportSettings): string {
    if (!model.sections || model.sections.length === 0) {
      return `
    <div class="pdf-page">
      <h2>Описание</h2>
      <p>Контент статьи отсутствует.</p>
    </div>`;
    }

    // Разбиваем секции на страницы
    // Каждая страница начинается с H2 заголовка
    const pages: string[] = [];
    let currentPageContent: string[] = [];
    let sectionIndex = 0;

    for (const section of model.sections) {
      const rendered = this.renderSection(section, sectionIndex);
      
      if (!rendered || rendered.trim().length === 0) {
        sectionIndex++;
        continue;
      }

      // Если это H2 заголовок и уже есть контент на странице, начинаем новую страницу
      if (section.type === 'heading' && section.level === 2 && currentPageContent.length > 0) {
        pages.push(`
    <div class="pdf-page">
      ${currentPageContent.join('\n')}
    </div>`);
        currentPageContent = [];
      }

      currentPageContent.push(rendered);
      sectionIndex++;
    }

    // Добавляем последнюю страницу
    if (currentPageContent.length > 0) {
      pages.push(`
    <div class="pdf-page">
      ${currentPageContent.join('\n')}
    </div>`);
    }

    // Если страниц нет, создаем одну с сообщением
    if (pages.length === 0) {
      return `
    <div class="pdf-page">
      <h2>Описание</h2>
      <p>Контент статьи отсутствует.</p>
    </div>`;
    }

    return pages.join('\n');
  }

  /**
   * Рендерит одну секцию
   */
  private renderSection(section: Section, index: number): string {
    switch (section.type) {
      case 'heading':
        const tag = section.level === 2 ? 'h2' : 'h3';
        return `<${tag} id="section-${index}">${this.escapeHtml(section.text)}</${tag}>`;

      case 'paragraph':
        const paragraphText = section.html ? this.sanitizeHtml(section.html) : this.escapeHtml(section.text);
        if (!paragraphText || paragraphText.trim().length === 0) {
          return '';
        }
        return `<p>${paragraphText}</p>`;

      case 'list':
        const tagName = section.ordered ? 'ol' : 'ul';
        const items = section.items.map((item: string) => `<li>${this.escapeHtml(item)}</li>`).join('');
        return `<${tagName}>${items}</${tagName}>`;

      case 'quote':
        const variant = section.variant || 'quote';
        if (variant === 'quote') {
          return `<blockquote>${this.escapeHtml(section.text)}${section.author ? `<cite>— ${this.escapeHtml(section.author)}</cite>` : ''}</blockquote>`;
        }
        // Для tip/warning/info используем инфоблоки
        return this.renderInfoBlock(variant, section.text, section.author);

      case 'image':
        return `
        <div class="content-section">
          <img src="${this.escapeHtml(section.image.url)}" alt="${this.escapeHtml(section.image.alt || '')}" class="content-image" />
          ${section.caption ? `<p class="image-caption">${this.escapeHtml(section.caption)}</p>` : ''}
        </div>`;

      case 'imageGallery':
        const galleryImages = section.images.map((img: { url: string; alt?: string }) => 
          `<img src="${this.escapeHtml(img.url)}" alt="${this.escapeHtml(img.alt || '')}" />`
        ).join('');
        return `
        <div class="content-section">
          <div class="image-gallery">
            ${galleryImages}
          </div>
          ${section.caption ? `<p class="image-caption">${this.escapeHtml(section.caption)}</p>` : ''}
        </div>`;

      case 'infoBlock':
        return this.renderInfoBlock(section.variant, section.text, section.title);

      default:
        return '';
    }
  }

  /**
   * Рендерит инфоблок
   */
  private renderInfoBlock(variant: 'tip' | 'important' | 'warning' | 'recommendation', text: string, title?: string): string {
    const variantMap: Record<string, string> = {
      tip: 'Совет',
      important: 'Важно',
      warning: 'Предупреждение',
      recommendation: 'Рекомендация',
    };

    const label = variantMap[variant] || 'Информация';

    return `
    <div class="info-block ${variant}">
      ${title ? `<div class="info-block-title">${this.escapeHtml(title)}</div>` : `<div class="info-block-title">${label}</div>`}
      <p>${this.escapeHtml(text)}</p>
    </div>`;
  }

  /**
   * Генерирует страницу с картой
   */
  private generateMapPage(map: ArticlePdfModel['map']): string {
    if (!map) return '';

    const mapImage = map.image.url
      ? `<img src="${this.escapeHtml(map.image.url)}" alt="${this.escapeHtml(map.image.alt || '')}" class="map-image" />`
      : '<p>Карта будет сгенерирована</p>';

    const points = map.points
      ? map.points.map((point) => `
        <div class="map-point">
          <div class="map-point-name">${this.escapeHtml(point.name)}</div>
          <div class="map-point-coords">${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}${point.distance ? ` • ${point.distance} км` : ''}</div>
          ${point.description ? `<div>${this.escapeHtml(point.description)}</div>` : ''}
        </div>
      `).join('')
      : '';

    return `
    <div class="pdf-page map-page">
      <h2>Карта маршрута</h2>
      ${mapImage}
      ${map.description ? `<p>${this.escapeHtml(map.description)}</p>` : ''}
      ${points ? `<div class="map-points">${points}</div>` : ''}
    </div>`;
  }

  /**
   * Генерирует страницу рекомендаций
   */
  private generateRecommendationsPage(recommendations: ArticlePdfModel['recommendations']): string {
    if (!recommendations || recommendations.length === 0) {
      return '';
    }

    const blocks = recommendations.map((rec) => `
      <h3>${this.escapeHtml(rec.title)}</h3>
      <ul class="recommendations-list">
        ${rec.items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}
      </ul>
    `).join('');

    return `
    <div class="pdf-page">
      <h2>Рекомендации и полезная информация</h2>
      ${blocks}
    </div>`;
  }

  /**
   * Генерирует заднюю обложку
   */
  private generateBackCover(model: ArticlePdfModel): string {
    const siteUrl = (typeof window !== 'undefined' && window.location) 
      ? window.location.origin 
      : 'https://metravel.by';
    const articleUrl = `${siteUrl}/travels/${model.title.toLowerCase().replace(/\s+/g, '-')}`;

    return `
    <div class="pdf-page back-cover">
      <div class="back-cover-logo">MeTravel</div>
      <p class="back-cover-url">${siteUrl}</p>
      <p class="back-cover-disclaimer">
        Документ сгенерирован автоматически. Все права на материалы принадлежат их авторам.
        Для получения актуальной информации посетите оригинальную статью на сайте.
      </p>
    </div>`;
  }

  /**
   * Получает размер формата
   */
  private getFormatSize(format: ArticleExportSettings['format']): { width: string; height: string } {
    switch (format) {
      case 'A4':
        return { width: '210mm', height: '297mm' };
      case 'Letter':
        return { width: '8.5in', height: '11in' };
      case 'A5':
        return { width: '148mm', height: '210mm' };
      default:
        return { width: '210mm', height: '297mm' };
    }
  }

  /**
   * Экранирует HTML
   */
  private escapeHtml(text: string): string {
    const div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (div) {
      div.textContent = text;
      return div.innerHTML;
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Санитизирует HTML (для случаев, когда нужно сохранить разметку)
   */
  private sanitizeHtml(html: string): string {
    if (!html || html.trim().length === 0) {
      return '';
    }

    // Простая санитизация - убираем опасные теги, но сохраняем структуру
    let cleaned = html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/style="[^"]*"/gi, ''); // Убираем inline стили

    // Извлекаем текст из тегов, если нужно
    const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (tempDiv) {
      tempDiv.innerHTML = cleaned;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      // Если после очистки остался только текст, возвращаем его
      if (text.trim().length > 0 && cleaned.replace(/<[^>]*>/g, '').trim() === text.trim()) {
        return text;
      }
    }

    return cleaned;
  }

  /**
   * Склоняет слова
   */
  private pluralize(count: number, one: string, few: string, many: string): string {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }
}
