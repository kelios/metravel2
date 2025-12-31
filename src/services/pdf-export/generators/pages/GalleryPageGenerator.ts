// src/services/pdf-export/generators/pages/GalleryPageGenerator.ts
// Генератор страниц с фотогалереями

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';

export type GalleryLayout = 'grid' | 'mosaic' | 'collage' | 'polaroid';

export interface GalleryPhoto {
  url: string;
  id?: number | string;
  caption?: string;
}

export class GalleryPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  /**
   * Генерирует страницу с галереей
   */
  generate(
    travelName: string,
    photos: GalleryPhoto[],
    layout: GalleryLayout,
    pageNumber: number
  ): string {
    const { colors, spacing } = this.theme;

    return `
      <section class="pdf-page gallery-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
        position: relative;
      ">
        ${this.renderHeader(travelName)}
        ${this.renderGallery(photos, layout)}
        ${this.renderPageNumber(pageNumber)}
      </section>
    `;
  }

  private renderHeader(travelName: string): string {
    const { colors, typography } = this.theme;

    return `
      <div style="margin-bottom: 15mm; text-align: center;">
        <h2 style="
          font-size: ${typography.h2.size};
          font-weight: ${typography.h2.weight};
          margin: 0;
          color: ${colors.text};
          font-family: ${typography.headingFont};
        ">Фотогалерея</h2>
        <div style="
          font-size: 12pt;
          color: ${colors.textSecondary};
          margin-top: 4mm;
          font-family: ${typography.bodyFont};
        ">${this.escapeHtml(travelName)}</div>
      </div>
    `;
  }

  private renderGallery(photos: GalleryPhoto[], layout: GalleryLayout): string {
    switch (layout) {
      case 'grid':
        return this.renderGridLayout(photos);
      case 'mosaic':
        return this.renderMosaicLayout(photos);
      case 'collage':
        return this.renderCollageLayout(photos);
      case 'polaroid':
        return this.renderPolaroidLayout(photos);
      default:
        return this.renderGridLayout(photos);
    }
  }

  /**
   * Сетка 3x3 - классическая раскладка
   */
  private renderGridLayout(photos: GalleryPhoto[]): string {
    const { colors } = this.theme;

    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6mm;
        margin-bottom: 15mm;
      ">
        ${photos.slice(0, 9).map(photo => `
          <div style="
            aspect-ratio: 1;
            overflow: hidden;
            border-radius: 8px;
            background: ${colors.surfaceAlt};
          ">
            <img
              src="${this.escapeHtml(photo.url)}"
              alt="Gallery photo"
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
              "
              crossorigin="anonymous"
            />
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Мозаика - Pinterest-style с разными размерами
   */
  private renderMosaicLayout(photos: GalleryPhoto[]): string {
    const { colors } = this.theme;
    
    // Паттерн размеров: большой, маленький, маленький, маленький, большой...
    const pattern = ['large', 'small', 'small', 'small', 'large', 'small', 'small', 'small'];

    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 5mm;
        margin-bottom: 15mm;
      ">
        ${photos.slice(0, 8).map((photo, index) => {
          const size = pattern[index % pattern.length];
          const isLarge = size === 'large';
          
          return `
            <div style="
              grid-column: ${isLarge ? 'span 2' : 'span 1'};
              grid-row: ${isLarge ? 'span 2' : 'span 1'};
              overflow: hidden;
              border-radius: 12px;
              background: ${colors.surfaceAlt};
              box-shadow: ${this.theme.blocks.shadow};
            ">
              <img
                src="${this.escapeHtml(photo.url)}"
                alt="Gallery photo"
                style="
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
                "
                crossorigin="anonymous"
              />
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Коллаж - художественная раскладка с наложением
   */
  private renderCollageLayout(photos: GalleryPhoto[]): string {
    const { colors } = this.theme;

    return `
      <div style="
        position: relative;
        height: 200mm;
        margin-bottom: 15mm;
      ">
        ${photos.slice(0, 6).map((photo, index) => {
          const positions = [
            { top: '0', left: '0', width: '45%', height: '55%', zIndex: 1 },
            { top: '0', right: '0', width: '50%', height: '45%', zIndex: 2 },
            { top: '40%', left: '5%', width: '40%', height: '35%', zIndex: 3 },
            { bottom: '0', left: '0', width: '35%', height: '40%', zIndex: 2 },
            { bottom: '5%', right: '5%', width: '45%', height: '50%', zIndex: 1 },
            { top: '50%', left: '40%', width: '25%', height: '30%', zIndex: 4 },
          ];
          
          const pos = positions[index];
          
          return `
            <div style="
              position: absolute;
              ${pos.top ? `top: ${pos.top};` : ''}
              ${pos.bottom ? `bottom: ${pos.bottom};` : ''}
              ${pos.left ? `left: ${pos.left};` : ''}
              ${pos.right ? `right: ${pos.right};` : ''}
              width: ${pos.width};
              height: ${pos.height};
              overflow: hidden;
              border-radius: 12px;
              background: ${colors.surfaceAlt};
              box-shadow: 0 8px 24px rgba(0,0,0,0.15);
              border: 3px solid #ffffff;
              z-index: ${pos.zIndex};
            ">
              <img
                src="${this.escapeHtml(photo.url)}"
                alt="Gallery photo"
                style="
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
                "
                crossorigin="anonymous"
              />
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Полароид - ретро стиль с рамками и подписями
   */
  private renderPolaroidLayout(photos: GalleryPhoto[]): string {
    const { colors } = this.theme;

    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10mm;
        margin-bottom: 15mm;
      ">
        ${photos.slice(0, 6).map((photo, index) => `
          <div style="
            background: #ffffff;
            padding: 8mm 8mm 12mm 8mm;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 4px;
            transform: rotate(${this.getRandomRotation()}deg);
          ">
            <div style="
              aspect-ratio: 1;
              overflow: hidden;
              background: ${colors.surfaceAlt};
              margin-bottom: 6mm;
            ">
              <img
                src="${this.escapeHtml(photo.url)}"
                alt="Gallery photo"
                style="
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
                "
                crossorigin="anonymous"
              />
            </div>
            ${photo.caption ? `
              <div style="
                text-align: center;
                font-size: 9pt;
                color: #4a4a4a;
                font-family: 'Courier New', monospace;
                line-height: 1.4;
              ">${this.escapeHtml(photo.caption)}</div>
            ` : `
              <div style="
                text-align: center;
                font-size: 9pt;
                color: #9b9b9b;
                font-family: 'Courier New', monospace;
              ">Фото ${index + 1}</div>
            `}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderPageNumber(pageNumber: number): string {
    const { colors } = this.theme;

    return `
      <div style="
        position: absolute;
        bottom: 15mm;
        right: 25mm;
        font-size: 12pt;
        color: ${colors.textMuted};
        font-weight: 500;
      ">${pageNumber}</div>
    `;
  }

  private getRandomRotation(): number {
    // Небольшой случайный наклон для эффекта полароида
    const rotations = [-2, -1, 0, 1, 2];
    return rotations[Math.floor(Math.random() * rotations.length)];
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
