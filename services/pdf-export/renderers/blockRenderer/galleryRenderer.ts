import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import type { ParsedContentBlock } from '../../parsers/ContentParser';

type GalleryImage = { src: string; alt?: string; caption?: string; width?: number; height?: number };

type RenderImageGalleryDeps = {
  theme: PdfThemeConfig;
  detectPortraitIndex: (images: Array<{ width?: number; height?: number }>, fallbackIndex: number) => number;
  renderGalleryImageCard: (
    img: GalleryImage,
    options?: { containerStyle?: string; imageStyle?: string }
  ) => string;
};

export function renderImageGallery(
  { theme, detectPortraitIndex, renderGalleryImageCard }: RenderImageGalleryDeps,
  block: ParsedContentBlock & { type: 'image-gallery' }
): string {
    const { images, columns = 2, layout = 'grid-default' } = block;

    if (layout === 'grid-mixed' || layout === 'grid-mixed-reverse' || layout === 'quilt-3') {
      const portraitIndex = detectPortraitIndex(images, layout === 'grid-mixed-reverse' ? 0 : images.length - 1);
      const portrait = images[portraitIndex];
      const supporting = images.filter((_, index) => index !== portraitIndex);

      if (portrait && supporting.length >= 2) {
        const stackHtml = supporting
          .map((img) =>
            renderGalleryImageCard(img, {
              imageStyle: 'min-height: 36mm; max-height: 44mm;',
            })
          )
          .join('');
        const portraitHtml = renderGalleryImageCard(portrait, {
          imageStyle: 'min-height: 80mm; max-height: 96mm;',
        });

        return `
          <div style="
            display: grid;
            grid-template-columns: ${layout === 'grid-mixed-reverse' ? '1.08fr 0.92fr' : '0.92fr 1.08fr'};
            gap: ${theme.spacing.elementSpacing};
            margin: calc(${theme.spacing.blockSpacing} * 0.9) 0 calc(${theme.spacing.blockSpacing} * 1.05);
            page-break-inside: avoid;
            break-inside: avoid;
            align-items: stretch;
          ">
            ${layout === 'grid-mixed-reverse' ? portraitHtml : `<div style="display:flex; flex-direction:column; gap:${theme.spacing.elementSpacing};">${stackHtml}</div>`}
            ${layout === 'grid-mixed-reverse' ? `<div style="display:flex; flex-direction:column; gap:${theme.spacing.elementSpacing};">${stackHtml}</div>` : portraitHtml}
          </div>
        `;
      }
    }

    if (layout === 'stack-landscape') {
      const cards = images
        .map((img, index) =>
          renderGalleryImageCard(img, {
            containerStyle: index === 0 ? 'transform: translateY(3mm);' : 'transform: translateY(-3mm);',
            imageStyle: 'min-height: 54mm; max-height: 64mm;',
          })
        )
        .join('');

      return `
        <div style="
          display: grid;
          grid-template-columns: 1.14fr 0.86fr;
          gap: ${theme.spacing.elementSpacing};
          margin: calc(${theme.spacing.blockSpacing} * 0.9) 0 calc(${theme.spacing.blockSpacing} * 1.05);
          page-break-inside: avoid;
          break-inside: avoid;
          align-items: start;
        ">${cards}</div>
      `;
    }

    const imagesHtml = images
      .map((img, index) => {
        let containerStyle = '';
        let imageStyle = '';

        if (layout === 'pair-portraits') {
          imageStyle = 'min-height: 68mm; max-height: 82mm;';
          containerStyle = index === 0 ? 'transform: translateY(4mm);' : 'transform: translateY(-4mm);';
        } else if (layout === 'pair-mixed') {
          imageStyle = index === 0
            ? 'min-height: 58mm; max-height: 68mm;'
            : 'min-height: 64mm; max-height: 76mm;';
          containerStyle = index === 0 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'pair-balanced') {
          imageStyle = 'min-height: 56mm; max-height: 66mm;';
          containerStyle = index === 0 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'row-2-landscape' || layout === 'row-2-balanced') {
          imageStyle = 'min-height: 52mm; max-height: 62mm;';
        } else if (layout === 'row-2-portrait') {
          imageStyle = 'min-height: 64mm; max-height: 76mm;';
        } else if (layout === 'row-2-mixed') {
          imageStyle = 'min-height: 58mm; max-height: 70mm;';
        } else if (layout === 'column-portraits') {
          imageStyle = 'min-height: 62mm; max-height: 78mm;';
          containerStyle = index % 2 === 0 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'pair-grid') {
          imageStyle = 'min-height: 50mm; max-height: 64mm;';
          containerStyle = index === 0 || index === 3 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'editorial-grid') {
          containerStyle = index === 0 ? 'grid-column: span 2;' : index === 1 || index === 4 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
          imageStyle = index === 0
            ? 'min-height: 50mm; max-height: 64mm;'
            : 'min-height: 42mm; max-height: 52mm;';
        } else if (layout === 'grid-portrait') {
          imageStyle = 'min-height: 58mm; max-height: 76mm;';
        } else if (layout === 'grid-balanced') {
          imageStyle = 'min-height: 50mm; max-height: 64mm;';
        } else if (layout === 'grid-quilt' || layout === 'quilt-4') {
          const span = index === 0 || index === 3 ? 4 : 2;
          containerStyle = `grid-column: span ${span};`;
          imageStyle = span === 4
            ? 'min-height: 46mm; max-height: 58mm;'
            : 'min-height: 36mm; max-height: 46mm;';
        } else {
          imageStyle = 'min-height: 44mm; max-height: 62mm;';
        }

        return renderGalleryImageCard(img, {
          containerStyle,
          imageStyle,
        });
      })
      .join('');

    return `
      <div style="
        display: grid;
        grid-template-columns: ${
          layout === 'pair-portraits' ? '0.96fr 1.04fr'
          : layout === 'pair-mixed' ? '0.92fr 1.08fr'
          : layout === 'pair-balanced' ? '1.02fr 0.98fr'
          : layout === 'pair-grid' ? '1.04fr 0.96fr'
          : layout === 'column-portraits' ? '0.94fr 1.06fr'
          : layout === 'editorial-grid' ? 'repeat(3, 1fr)'
          : `repeat(${columns}, 1fr)`
        };
        gap: ${theme.spacing.elementSpacing};
        margin: calc(${theme.spacing.blockSpacing} * 0.9) 0 calc(${theme.spacing.blockSpacing} * 1.05);
        page-break-inside: avoid;
        break-inside: avoid;
        align-items: start;
      ">${imagesHtml}</div>
    `;
}
