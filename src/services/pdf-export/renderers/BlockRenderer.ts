// src/services/pdf-export/renderers/BlockRenderer.ts
// ✅ АРХИТЕКТУРА: Рендерер блоков контента в HTML

import type { PdfThemeConfig } from '../themes/PdfThemeConfig';
import type { ParsedContentBlock } from '../parsers/ContentParser';

/**
 * Рендерер блоков контента
 */
export class BlockRenderer {
  constructor(private theme: PdfThemeConfig) {}

  /**
   * Рендерит массив блоков в HTML
   */
  renderBlocks(blocks: ParsedContentBlock[]): string {
    return blocks.map((block) => this.renderBlock(block)).join('\n');
  }

  /**
   * Рендерит один блок
   */
  renderBlock(block: ParsedContentBlock): string {
    switch (block.type) {
      case 'heading':
        return this.renderHeading(block);
      case 'paragraph':
        return this.renderParagraph(block);
      case 'list':
        return this.renderList(block);
      case 'quote':
        return this.renderQuote(block);
      case 'image':
        return this.renderImage(block);
      case 'image-gallery':
        return this.renderImageGallery(block);
      case 'info-block':
      case 'warning-block':
      case 'tip-block':
      case 'danger-block':
        return this.renderInfoBlock(block);
      case 'code':
        return this.renderCode(block);
      case 'separator':
        return this.renderSeparator();
      case 'table':
        return this.renderTable(block);
      default:
        return '';
    }
  }

  /**
   * Рендерит заголовок
   */
  private renderHeading(block: ParsedContentBlock & { type: 'heading' }): string {
    const { level, text } = block;
    const style = this.theme.typography[`h${level}` as keyof typeof this.theme.typography] as {
      size: string;
      weight: number;
      lineHeight: number;
      marginBottom: string;
    };

    return `
      <h${level} style="
        font-size: ${style.size};
        font-weight: ${style.weight};
        line-height: ${style.lineHeight};
        margin-bottom: ${style.marginBottom};
        color: ${this.theme.colors.text};
        font-family: ${this.theme.typography.headingFont};
        page-break-after: avoid;
        orphans: 3;
        widows: 3;
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${this.escapeHtml(text)}</h${level}>
    `;
  }

  /**
   * Рендерит параграф
   */
  private renderParagraph(block: ParsedContentBlock & { type: 'paragraph' }): string {
    const { text, html } = block;
    const style = this.theme.typography.body;

    // Если есть HTML, используем его (для форматирования)
    const content = html && html !== text ? html : this.escapeHtml(text);

    return `
      <p style="
        font-size: ${style.size};
        line-height: ${style.lineHeight};
        margin-bottom: ${style.marginBottom};
        color: ${this.theme.colors.text};
        font-family: ${this.theme.typography.bodyFont};
        text-align: justify;
        orphans: 2;
        widows: 2;
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${content}</p>
    `;
  }

  /**
   * Рендерит список
   */
  private renderList(block: ParsedContentBlock & { type: 'list' }): string {
    const { ordered, items } = block;
    const style = this.theme.typography.body;
    const tag = ordered ? 'ol' : 'ul';

    const itemsHtml = items
      .map(
        (item) => `
      <li style="
        font-size: ${style.size};
        line-height: ${style.lineHeight};
        margin-bottom: ${this.theme.spacing.elementSpacing};
        color: ${this.theme.colors.text};
        font-family: ${this.theme.typography.bodyFont};
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${this.escapeHtml(item)}</li>
    `
      )
      .join('');

    return `
      <${tag} style="
        margin-bottom: ${this.theme.spacing.blockSpacing};
        padding-left: 1.5em;
        page-break-inside: avoid;
      ">${itemsHtml}</${tag}>
    `;
  }

  /**
   * Рендерит цитату
   */
  private renderQuote(block: ParsedContentBlock & { type: 'quote' }): string {
    const { text, author } = block;
    const style = this.theme.typography.body;

    return `
      <blockquote style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        padding: ${this.theme.spacing.elementSpacing} ${this.theme.spacing.blockSpacing};
        border-left: 4px solid ${this.theme.colors.accent};
        background: ${this.theme.colors.surfaceAlt};
        border-radius: ${this.theme.blocks.borderRadius};
        font-size: ${style.size};
        line-height: ${style.lineHeight};
        color: ${this.theme.colors.textSecondary};
        font-family: ${this.theme.typography.bodyFont};
        font-style: italic;
        page-break-inside: avoid;
      ">
        <p style="margin: 0 0 ${author ? this.theme.spacing.elementSpacing : 0} 0;">
          ${this.escapeHtml(text)}
        </p>
        ${author ? `<cite style="font-size: ${this.theme.typography.small.size}; color: ${this.theme.colors.textMuted}; font-style: normal;">— ${this.escapeHtml(author)}</cite>` : ''}
      </blockquote>
    `;
  }

  /**
   * Рендерит изображение
   */
  private renderImage(block: ParsedContentBlock & { type: 'image' }): string {
    const { src, alt, caption, width, height } = block;
    const safeSrc = this.buildSafeImageUrl(src);

    const imageStyle = `
      max-width: 100%;
      height: auto;
      display: block;
      margin: ${this.theme.spacing.blockSpacing} auto;
      border-radius: ${this.theme.blocks.borderRadius};
      box-shadow: ${this.theme.blocks.shadow};
      page-break-inside: avoid;
    `;

    const imageTag = `
      <img 
        src="${this.escapeHtml(safeSrc)}" 
        alt="${this.escapeHtml(alt || '')}"
        ${width ? `width="${width}"` : ''}
        ${height ? `height="${height}"` : ''}
        style="${imageStyle}"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        crossorigin="anonymous"
      />
    `;

    const placeholder = `
      <div style="
        display: none;
        width: 100%;
        min-height: 200px;
        background: ${this.theme.colors.surfaceAlt};
        border: 2px dashed ${this.theme.colors.border};
        border-radius: ${this.theme.blocks.borderRadius};
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${this.theme.colors.textMuted};
        font-family: ${this.theme.typography.bodyFont};
        margin: ${this.theme.spacing.blockSpacing} auto;
      ">
        Изображение недоступно
      </div>
    `;

    if (caption) {
      return `
        <figure style="
          margin: ${this.theme.spacing.blockSpacing} 0;
          page-break-inside: avoid;
        ">
          ${imageTag}
          ${placeholder}
          <figcaption style="
            font-size: ${this.theme.typography.caption.size};
            line-height: ${this.theme.typography.caption.lineHeight};
            color: ${this.theme.colors.textMuted};
            text-align: center;
            margin-top: ${this.theme.spacing.elementSpacing};
            font-family: ${this.theme.typography.bodyFont};
          ">${this.escapeHtml(caption)}</figcaption>
        </figure>
      `;
    }

    return `
      <div style="margin: ${this.theme.spacing.blockSpacing} 0;">
        ${imageTag}
        ${placeholder}
      </div>
    `;
  }

  /**
   * Рендерит галерею изображений
   */
  private renderImageGallery(block: ParsedContentBlock & { type: 'image-gallery' }): string {
    const { images, columns = 2 } = block;

    const imagesHtml = images
      .map(
        (img) => `
      <div style="
        page-break-inside: avoid;
        margin-bottom: ${this.theme.spacing.elementSpacing};
      ">
        <img 
          src="${this.escapeHtml(this.buildSafeImageUrl(img.src))}" 
          alt="${this.escapeHtml(img.alt || '')}"
          style="
            width: 100%;
            height: auto;
            display: block;
            border-radius: ${this.theme.blocks.borderRadius};
            box-shadow: ${this.theme.blocks.shadow};
          "
          onerror="this.style.display='none';"
          crossorigin="anonymous"
        />
        ${img.caption ? `<div style="font-size: ${this.theme.typography.caption.size}; color: ${this.theme.colors.textMuted}; text-align: center; margin-top: 4pt;">${this.escapeHtml(img.caption)}</div>` : ''}
      </div>
    `
      )
      .join('');

    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        gap: ${this.theme.spacing.elementSpacing};
        margin: ${this.theme.spacing.blockSpacing} 0;
        page-break-inside: avoid;
      ">${imagesHtml}</div>
    `;
  }

  /**
   * Рендерит информационный блок (Совет, Важно, и т.д.)
   */
  private renderInfoBlock(block: ParsedContentBlock & { type: 'info-block' | 'warning-block' | 'tip-block' | 'danger-block' }): string {
    const { type, title, content } = block;
    
    const config = this.theme.colors[`${type.replace('-block', '')}Block` as keyof typeof this.theme.colors] as {
      background: string;
      border: string;
      text: string;
      icon: string;
    };

    const icons: Record<string, string> = {
      'info-block': 'ℹ️',
      'warning-block': '⚠️',
      'tip-block': '💡',
      'danger-block': '🚨',
    };

    const icon = icons[type] || 'ℹ️';
    const style = this.theme.typography.body;

    return `
      <div style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        padding: ${this.theme.spacing.elementSpacing} ${this.theme.spacing.blockSpacing};
        background: ${config.background};
        border-left: 4px solid ${config.border};
        border-radius: ${this.theme.blocks.borderRadius};
        page-break-inside: avoid;
        box-shadow: ${this.theme.blocks.shadow};
      ">
        <div style="
          display: flex;
          align-items: flex-start;
          gap: ${this.theme.spacing.elementSpacing};
        ">
          <div style="
            font-size: 20pt;
            line-height: 1;
            flex-shrink: 0;
          ">${icon}</div>
          <div style="flex: 1;">
            ${title ? `<div style="font-weight: 700; font-size: ${this.theme.typography.h4.size}; color: ${config.text}; margin-bottom: ${this.theme.spacing.elementSpacing}; font-family: ${this.theme.typography.headingFont};">
              ${this.escapeHtml(title)}
            </div>` : ''}
            <div style="
              font-size: ${style.size};
              line-height: ${style.lineHeight};
              color: ${config.text};
              font-family: ${this.theme.typography.bodyFont};
            ">${this.escapeHtml(content)}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Рендерит код
   */
  private renderCode(block: ParsedContentBlock & { type: 'code' }): string {
    const { code } = block;

    return `
      <pre style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        padding: ${this.theme.spacing.elementSpacing};
        background: ${this.theme.colors.surfaceAlt};
        border: 1px solid ${this.theme.colors.border};
        border-radius: ${this.theme.blocks.borderRadius};
        overflow-x: auto;
        font-family: ${this.theme.typography.monoFont};
        font-size: ${this.theme.typography.small.size};
        line-height: ${this.theme.typography.small.lineHeight};
        color: ${this.theme.colors.text};
        page-break-inside: avoid;
      "><code>${this.escapeHtml(code)}</code></pre>
    `;
  }

  /**
   * Рендерит разделитель
   */
  private renderSeparator(): string {
    return `
      <hr style="
        margin: ${this.theme.spacing.sectionSpacing} 0;
        border: none;
        border-top: 1px solid ${this.theme.colors.border};
        page-break-after: avoid;
      " />
    `;
  }

  /**
   * Рендерит таблицу
   */
  private renderTable(block: ParsedContentBlock & { type: 'table' }): string {
    const { headers, rows } = block;
    const style = this.theme.typography.body;

    const headersHtml = headers
      ? `
      <thead>
        <tr>
          ${headers.map((header) => `
            <th style="
              padding: ${this.theme.spacing.elementSpacing};
              background: ${this.theme.colors.surfaceAlt};
              border: 1px solid ${this.theme.colors.border};
              font-weight: 700;
              font-size: ${style.size};
              color: ${this.theme.colors.text};
              text-align: left;
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">${this.escapeHtml(header)}</th>
          `).join('')}
        </tr>
      </thead>
    `
      : '';

    const rowsHtml = rows
      .map(
        (row) => `
      <tr>
        ${row.map((cell) => `
          <td style="
            padding: ${this.theme.spacing.elementSpacing};
            border: 1px solid ${this.theme.colors.border};
            font-size: ${style.size};
            color: ${this.theme.colors.text};
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">${this.escapeHtml(cell)}</td>
        `).join('')}
      </tr>
    `
      )
      .join('');

    return `
      <div style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        overflow-x: auto;
        page-break-inside: avoid;
      ">
        <table style="
          width: 100%;
          border-collapse: collapse;
          border: 1px solid ${this.theme.colors.border};
          border-radius: ${this.theme.blocks.borderRadius};
          overflow: hidden;
          page-break-inside: avoid;
        ">
          ${headersHtml}
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  /**
   * Экранирует HTML
   */
  private escapeHtml(text: string): string {
    if (typeof document === 'undefined') {
      // Fallback для серверного рендеринга
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Строит безопасный URL изображения
   */
  private buildSafeImageUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Используем прокси для внешних изображений
      try {
        const encoded = encodeURIComponent(url);
        return `https://images.weserv.nl/?url=${encoded}&w=1600&fit=inside`;
      } catch {
        return url;
      }
    }
    return url;
  }
}

