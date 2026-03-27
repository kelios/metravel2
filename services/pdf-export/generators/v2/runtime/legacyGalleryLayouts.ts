import type {
  CaptionPosition,
  CollageTemplate,
  FullGallerySettings,
  GalleryLayout,
  GalleryPhoto,
  GallerySettings,
  MasonrySettings,
} from '@/types/pdf-gallery';

function getLegacyImageFilter(settings: GallerySettings | FullGallerySettings): string | undefined {
  return (settings as any)?.theme?.imageFilter ?? (settings as any)?.imageFilter;
}

function getLegacySpacing(
  spacing: 'compact' | 'normal' | 'spacious',
  values: { compact: number; normal: number; spacious: number }
): number {
  switch (spacing) {
    case 'compact':
      return values.compact;
    case 'spacious':
      return values.spacious;
    default:
      return values.normal;
  }
}

function getLegacyBorderStyle(
  borderStyle: 'none' | 'thin' | 'thick' | 'polaroid' | undefined,
  fallbackRadius: string
): string {
  switch (borderStyle) {
    case 'thin':
      return 'border: 1px solid #e5e7eb; border-radius: 6px;';
    case 'thick':
      return 'border: 3px solid #d1d5db; border-radius: 8px;';
    case 'polaroid':
      return 'border: 12px solid #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 2px;';
    default:
      return fallbackRadius;
  }
}

function renderLegacyMetadata(photo: GalleryPhoto): string {
  if (!photo.exif) return '';

  const metadata: string[] = [];
  if (photo.exif.camera) metadata.push(photo.exif.camera);
  if (photo.exif.lens) metadata.push(photo.exif.lens);
  if (photo.exif.focalLength) metadata.push(photo.exif.focalLength);
  if (photo.exif.aperture) metadata.push(`f/${photo.exif.aperture}`);
  if (photo.exif.iso) metadata.push(`ISO ${photo.exif.iso}`);
  if (photo.exif.shutterSpeed) metadata.push(photo.exif.shutterSpeed);

  if (metadata.length === 0) return '';

  return `
    <p style="
      margin: 4px 0 0 0;
      font-size: 10px;
      opacity: 0.6;
      font-family: monospace;
    ">
      ${metadata.join(' • ')}
    </p>
  `;
}

function renderLegacyCaption(
  photo: GalleryPhoto,
  position: CaptionPosition,
  opts?: { overlayPadding?: string; nonOverlayPadding?: string }
): string {
  if (!photo.caption) return '';

  const isOverlay = position === 'overlay';
  const overlayPadding = opts?.overlayPadding || '16px 12px 12px 12px';
  const nonOverlayPadding = opts?.nonOverlayPadding || '12px';
  const overlayStyle = isOverlay
    ? `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      color: #ffffff;
      padding: ${overlayPadding};
    `
    : `
      background: #f9fafb;
      color: #1f2937;
      padding: ${nonOverlayPadding};
    `;

  return `
    <div class="photo-caption" style="${overlayStyle}">
      ${photo.caption.text ? `
        <p style="
          margin: 0 0 4px 0;
          font-size: ${isOverlay ? '13px' : '14px'};
          font-weight: 500;
          line-height: 1.4;
        ">${photo.caption.text}</p>
      ` : ''}
      ${photo.caption.location || photo.caption.date ? `
        <p style="
          margin: 0;
          font-size: ${isOverlay ? '11px' : '12px'};
          opacity: ${isOverlay ? '0.9' : '0.8'};
          line-height: 1.3;
        ">
          ${photo.caption.location || ''}
          ${photo.caption.location && photo.caption.date ? ' • ' : ''}
          ${photo.caption.date || ''}
        </p>
      ` : ''}
      ${photo.caption.showMetadata ? renderLegacyMetadata(photo) : ''}
    </div>
  `;
}

export class GridGalleryGenerator {
  generateHTML(photos: GalleryPhoto[], settings: GallerySettings): string {
    const columns = settings.columns || 3;
    const spacing = getLegacySpacing(settings.spacing, { compact: 8, normal: 16, spacious: 24 });
    const borderStyle = getLegacyBorderStyle(settings.borderStyle, '');

    return `
      <div class="gallery-grid" style="
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        gap: ${spacing}px;
        padding: ${spacing}px;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${photos.map((photo) => this.generatePhotoCard(photo, settings, borderStyle)).join('')}
      </div>
    `;
  }

  private generatePhotoCard(photo: GalleryPhoto, settings: GallerySettings, borderStyle: string): string {
    const imageFilter = getLegacyImageFilter(settings);
    const showCaption = settings.showCaptions && photo.caption;
    const captionPosition = settings.captionPosition;

    return `
      <div class="photo-card" style="
        position: relative;
        overflow: hidden;
        ${borderStyle}
        background: #ffffff;
      ">
        ${captionPosition === 'top' && showCaption ? renderLegacyCaption(photo, 'top') : ''}
        <div class="photo-container" style="
          position: relative;
          width: 100%;
          padding-bottom: 75%;
          overflow: hidden;
        ">
          <img
            src="${photo.url}"
            alt="${photo.caption?.text || ''}"
            style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              ${imageFilter ? `filter: ${imageFilter};` : ''}
            "
          />
          ${captionPosition === 'overlay' && showCaption ? renderLegacyCaption(photo, 'overlay') : ''}
        </div>
        ${captionPosition === 'bottom' && showCaption ? renderLegacyCaption(photo, 'bottom') : ''}
      </div>
    `;
  }
}

export class MasonryGalleryGenerator {
  generateHTML(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const masonrySettings = settings.masonry || {
      columns: 3,
      gap: 16,
      maintainAspectRatio: true,
    };
    const columns = this.distributePhotos(photos, masonrySettings.columns);

    return `
      <div class="gallery-masonry" style="
        display: flex;
        gap: ${masonrySettings.gap}px;
        padding: ${masonrySettings.gap}px;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${columns.map((columnPhotos) => this.generateColumn(columnPhotos, settings, masonrySettings)).join('')}
      </div>
    `;
  }

  private distributePhotos(photos: GalleryPhoto[], columnCount: number): GalleryPhoto[][] {
    const columns: GalleryPhoto[][] = Array.from({ length: columnCount }, () => []);
    const columnHeights: number[] = Array(columnCount).fill(0);

    photos.forEach((photo) => {
      const minHeightIndex = columnHeights.indexOf(Math.min(...columnHeights));
      columns[minHeightIndex].push(photo);
      const aspectRatio = photo.aspectRatio || (photo.height && photo.width ? photo.height / photo.width : 1);
      columnHeights[minHeightIndex] += aspectRatio;
    });

    return columns;
  }

  private generateColumn(
    photos: GalleryPhoto[],
    settings: FullGallerySettings,
    masonrySettings: MasonrySettings
  ): string {
    return `
      <div class="masonry-column" style="
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: ${masonrySettings.gap}px;
      ">
        ${photos.map((photo) => this.generatePhotoCard(photo, settings, masonrySettings)).join('')}
      </div>
    `;
  }

  private generatePhotoCard(
    photo: GalleryPhoto,
    settings: FullGallerySettings,
    masonrySettings: MasonrySettings
  ): string {
    const imageFilter = getLegacyImageFilter(settings);
    const showCaption = settings.showCaptions && photo.caption;
    const captionPosition = settings.captionPosition;
    const borderStyle = getLegacyBorderStyle(settings.borderStyle, 'border-radius: 4px;');
    const aspectRatio = photo.aspectRatio || (photo.height && photo.width ? photo.height / photo.width : 1);
    const paddingBottom = masonrySettings.maintainAspectRatio ? `${aspectRatio * 100}%` : '75%';

    return `
      <div class="masonry-photo-card" style="
        position: relative;
        overflow: hidden;
        ${borderStyle}
        background: #ffffff;
        break-inside: avoid;
      ">
        ${captionPosition === 'top' && showCaption ? renderLegacyCaption(photo, 'top') : ''}
        <div class="photo-container" style="
          position: relative;
          width: 100%;
          padding-bottom: ${paddingBottom};
          overflow: hidden;
        ">
          <img
            src="${photo.url}"
            alt="${photo.caption?.text || ''}"
            style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              ${imageFilter ? `filter: ${imageFilter};` : ''}
            "
          />
          ${captionPosition === 'overlay' && showCaption ? renderLegacyCaption(photo, 'overlay') : ''}
        </div>
        ${captionPosition === 'bottom' && showCaption ? renderLegacyCaption(photo, 'bottom') : ''}
      </div>
    `;
  }
}

export class CollageGalleryGenerator {
  generateHTML(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const collageSettings = settings.collage || {
      template: 'hero-left',
      gap: 12,
      borderRadius: 8,
      shadow: true,
    };
    const template = this.selectTemplate(photos.length, collageSettings.template);

    return `
      <div class="gallery-collage" style="
        padding: ${collageSettings.gap}px;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${this.generateCollageLayout(photos, template, settings)}
      </div>
    `;
  }

  private selectTemplate(photoCount: number, preferredTemplate: CollageTemplate): CollageTemplate {
    if (photoCount === 1) return 'hero-left';
    if (photoCount === 2) return 'symmetric';
    if (photoCount === 3) return 'hero-top';
    if (photoCount === 4) return 'symmetric';
    return preferredTemplate;
  }

  private generateCollageLayout(
    photos: GalleryPhoto[],
    template: CollageTemplate,
    settings: FullGallerySettings
  ): string {
    switch (template) {
      case 'hero-left':
        return this.generateHeroLeft(photos, settings);
      case 'hero-right':
        return this.generateHeroRight(photos, settings);
      case 'hero-top':
        return this.generateHeroTop(photos, settings);
      case 'hero-bottom':
        return this.generateHeroBottom(photos, settings);
      case 'symmetric':
        return this.generateSymmetric(photos, settings);
      case 'magazine':
        return this.generateMagazine(photos, settings);
      default:
        return this.generateHeroLeft(photos, settings);
    }
  }

  private generateHeroLeft(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;
    return `
      <div style="display: flex; gap: ${gap}px; height: 600px;">
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: ${gap}px;">
          ${rest.slice(0, 4).map((photo) => this.generatePhoto(photo, settings, '100%', `calc((100% - ${gap * 3}px) / 4)`)).join('')}
        </div>
      </div>
    `;
  }

  private generateHeroRight(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;
    return `
      <div style="display: flex; gap: ${gap}px; height: 600px;">
        <div style="flex: 1; display: flex; flex-direction: column; gap: ${gap}px;">
          ${rest.slice(0, 4).map((photo) => this.generatePhoto(photo, settings, '100%', `calc((100% - ${gap * 3}px) / 4)`)).join('')}
        </div>
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
      </div>
    `;
  }

  private generateHeroTop(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;
    return `
      <div style="display: flex; flex-direction: column; gap: ${gap}px; height: 600px;">
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
        <div style="flex: 1; display: flex; gap: ${gap}px;">
          ${rest.slice(0, 3).map((photo) => this.generatePhoto(photo, settings, `calc((100% - ${gap * 2}px) / 3)`, '100%')).join('')}
        </div>
      </div>
    `;
  }

  private generateHeroBottom(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;
    return `
      <div style="display: flex; flex-direction: column; gap: ${gap}px; height: 600px;">
        <div style="flex: 1; display: flex; gap: ${gap}px;">
          ${rest.slice(0, 3).map((photo) => this.generatePhoto(photo, settings, `calc((100% - ${gap * 2}px) / 3)`, '100%')).join('')}
        </div>
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
      </div>
    `;
  }

  private generateSymmetric(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const rows = Math.ceil(photos.length / 2);
    return `
      <div style="display: flex; flex-direction: column; gap: ${gap}px;">
        ${Array.from({ length: rows }).map((_, rowIndex) => {
          const rowPhotos = photos.slice(rowIndex * 2, rowIndex * 2 + 2);
          return `
            <div style="display: flex; gap: ${gap}px; height: ${600 / rows}px;">
              ${rowPhotos.map((photo) => this.generatePhoto(photo, settings, `calc((100% - ${gap}px) / 2)`, '100%')).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private generateMagazine(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    return `
      <div style="display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: repeat(3, 200px); gap: ${gap}px;">
        ${photos.slice(0, 5).map((photo, index) => {
          const areas = [
            '1 / 1 / 3 / 2',
            '1 / 2 / 2 / 3',
            '2 / 2 / 3 / 3',
            '3 / 1 / 4 / 2',
            '3 / 2 / 4 / 3',
          ];
          return this.generatePhoto(photo, settings, '100%', '100%', `grid-area: ${areas[index] || '1 / 1 / 2 / 2'};`);
        }).join('')}
      </div>
    `;
  }

  private generatePhoto(
    photo: GalleryPhoto,
    settings: FullGallerySettings,
    width: string,
    height: string,
    additionalStyle = ''
  ): string {
    const borderRadius = settings.collage?.borderRadius || 8;
    const shadow = settings.collage?.shadow ? 'box-shadow: 0 4px 6px rgba(0,0,0,0.1);' : '';
    const showCaption = settings.showCaptions && photo.caption && settings.captionPosition === 'overlay';
    const imageFilter = getLegacyImageFilter(settings);

    return `
      <div style="
        position: relative;
        width: ${width};
        height: ${height};
        overflow: hidden;
        border-radius: ${borderRadius}px;
        ${shadow}
        ${additionalStyle}
      ">
        <img
          src="${photo.url}"
          alt="${photo.caption?.text || ''}"
          style="
            width: 100%;
            height: 100%;
            object-fit: cover;
            ${imageFilter ? `filter: ${imageFilter};` : ''}
          "
        />
        ${showCaption ? renderLegacyCaption(photo, 'overlay', { overlayPadding: '16px 12px 12px 12px' }) : ''}
      </div>
    `;
  }
}

export class PolaroidGalleryGenerator {
  generateHTML(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const polaroidSettings = settings.polaroid || {
      frameColor: '#ffffff',
      frameWidth: 20,
      rotation: 3,
      shadow: true,
      showCaption: true,
      captionFont: 'handwritten',
    };
    const spacing = getLegacySpacing(settings.spacing, { compact: 16, normal: 24, spacious: 40 });

    return `
      <div class="gallery-polaroid" style="
        display: flex;
        flex-wrap: wrap;
        gap: ${spacing}px;
        padding: ${spacing}px;
        justify-content: center;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${photos.map((photo, index) => this.generatePolaroid(photo, index, settings, polaroidSettings)).join('')}
      </div>
    `;
  }

  private generatePolaroid(
    photo: GalleryPhoto,
    index: number,
    settings: FullGallerySettings,
    polaroidSettings: NonNullable<FullGallerySettings['polaroid']>
  ): string {
    const rotation = this.getRotation(index, polaroidSettings.rotation);
    const shadow = polaroidSettings.shadow
      ? 'box-shadow: 0 8px 16px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);'
      : '';
    const showCaption = polaroidSettings.showCaption && photo.caption;
    const captionFont =
      polaroidSettings.captionFont === 'handwritten'
        ? 'font-family: "Comic Sans MS", cursive; font-style: italic;'
        : 'font-family: "Courier New", monospace;';
    const imageFilter = getLegacyImageFilter(settings);

    return `
      <div class="polaroid" style="
        display: inline-block;
        background: ${polaroidSettings.frameColor};
        padding: ${polaroidSettings.frameWidth}px;
        padding-bottom: ${polaroidSettings.frameWidth + 60}px;
        transform: rotate(${rotation}deg);
        transition: transform 0.3s ease;
        ${shadow}
        max-width: 280px;
      ">
        <div class="polaroid-photo" style="
          width: 240px;
          height: 240px;
          overflow: hidden;
          background: #f0f0f0;
        ">
          <img
            src="${photo.url}"
            alt="${photo.caption?.text || ''}"
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              ${imageFilter ? `filter: ${imageFilter};` : ''}
            "
          />
        </div>
        ${showCaption ? `
          <div class="polaroid-caption" style="
            margin-top: 12px;
            text-align: center;
            ${captionFont}
            font-size: 14px;
            color: #333333;
            line-height: 1.4;
            padding: 0 8px;
          ">
            ${photo.caption?.text || ''}
            ${photo.caption?.location ? `<br><span style="font-size: 12px; opacity: 0.7;">${photo.caption.location}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  private getRotation(index: number, maxRotation: number): number {
    const pattern = [-1, 0.7, -0.3, 1, -0.7, 0.3];
    return pattern[index % pattern.length] * maxRotation;
  }
}

interface IGalleryGenerator {
  generateHTML(photos: GalleryPhoto[], settings: FullGallerySettings): string;
}

export class GalleryLayoutFactory {
  private static generators: Map<GalleryLayout, IGalleryGenerator> = new Map<GalleryLayout, IGalleryGenerator>([
    ['grid', new GridGalleryGenerator()],
    ['masonry', new MasonryGalleryGenerator()],
    ['collage', new CollageGalleryGenerator()],
    ['polaroid', new PolaroidGalleryGenerator()],
  ]);

  static generateGallery(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    if (!photos || photos.length === 0) {
      return '<div class="gallery-empty">Нет фотографий для отображения</div>';
    }

    const layout = settings.layout || 'grid';
    if (layout === 'slideshow') {
      return this.generateSlideshow(photos, settings);
    }

    const generator = this.generators.get(layout);
    if (!generator) {
      console.warn(`Генератор для раскладки "${layout}" не найден, используется grid`);
      return this.generators.get('grid')!.generateHTML(photos, settings);
    }

    return generator.generateHTML(photos, settings);
  }

  private static generateSlideshow(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const slideshowSettings = settings.slideshow || {
      photoSize: 'large',
      showCaption: true,
      showMetadata: true,
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
    };
    return photos.map((photo) => this.generateSlidePage(photo, slideshowSettings)).join('');
  }

  private static generateSlidePage(
    photo: GalleryPhoto,
    settings: NonNullable<FullGallerySettings['slideshow']>
  ): string {
    const photoSize =
      settings.photoSize === 'full'
        ? { width: '100%', height: '80vh' }
        : settings.photoSize === 'medium'
          ? { width: '70%', height: '60vh' }
          : { width: '85%', height: '70vh' };

    return `
      <div class="slideshow-page" style="
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: ${settings.backgroundColor};
        color: ${settings.textColor};
        page-break-after: always;
        padding: 40px;
      ">
        <div class="slide-photo" style="
          max-width: ${photoSize.width};
          max-height: ${photoSize.height};
          width: 100%;
          margin-bottom: ${settings.showCaption ? '32px' : '0'};
        ">
          <img
            src="${photo.url}"
            alt="${photo.caption?.text || ''}"
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
              box-shadow: 0 8px 24px rgba(0,0,0,0.12);
              border-radius: 8px;
            "
          />
        </div>
        ${settings.showCaption && photo.caption ? `
          <div class="slide-caption" style="
            max-width: 600px;
            text-align: center;
          ">
            ${photo.caption.text ? `
              <p style="
                margin: 0 0 12px 0;
                font-size: 20px;
                font-weight: 500;
                line-height: 1.4;
              ">${photo.caption.text}</p>
            ` : ''}
            ${photo.caption.location || photo.caption.date ? `
              <p style="
                margin: 0;
                font-size: 16px;
                opacity: 0.7;
                line-height: 1.3;
              ">
                ${photo.caption.location || ''}
                ${photo.caption.location && photo.caption.date ? ' • ' : ''}
                ${photo.caption.date || ''}
              </p>
            ` : ''}
            ${settings.showMetadata && photo.exif ? this.generateMetadata(photo) : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  private static generateMetadata(photo: GalleryPhoto): string {
    const markup = renderLegacyMetadata(photo);
    if (!markup) return '';
    return markup
      .replace('margin: 4px 0 0 0;', 'margin: 16px 0 0 0;')
      .replace('font-size: 10px;', 'font-size: 12px;')
      .replace('opacity: 0.6;', 'opacity: 0.5;');
  }
}
