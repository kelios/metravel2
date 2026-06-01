import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

export const responsiveStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => `
/* ===== MOBILE RESPONSIVE ===== */
@media (max-width: 768px) {
  .${cls} {
    font-size: 17px;
    line-height: 1.52;
    --travel-rich-breakout-width: 100%;
    padding: 0 ${DESIGN_TOKENS.spacing.sm}px 32px;
  }
  .${cls} img {
    border-radius: 10px;
  }
  .${cls} h2 {
    font-size: 24px;
    margin: 1.5em 0 0.5em;
  }
  .${cls} h3 {
    font-size: 19px;
    margin: 1.4em 0 0.4em;
  }
  .${cls} blockquote {
    margin: 1.5em 0;
    padding: 0 0 0 1em;
  }
  /* Mobile: no float, stack images */
  .${cls} .img-float-right,
  .${cls} .img-float-left {
    float: none;
    max-width: 100%;
    margin: 1em 0;
    padding-left: 0;
    padding-right: 0;
  }
  /* Mobile: 2 images still side by side but smaller */
  .${cls} .img-row-2 {
    width: 100%;
    position: static;
    left: auto;
    transform: none;
    gap: 8px;
  }
  .${cls} .img-row-2 img {
    height: 150px !important;
    max-height: 150px !important;
  }
  .${cls} .img-row-2-landscape img,
  .${cls} .img-row-2-balanced img {
    height: 160px !important;
    max-height: 160px !important;
  }
  .${cls} .img-row-2-mixed {
    grid-template-columns: 1fr 1fr;
  }
  .${cls} .img-stack-landscape,
  .${cls} .img-pair-balanced,
  .${cls} .img-pair-portraits,
  .${cls} .img-pair-mixed {
    width: 100%;
    grid-template-columns: 1fr 1fr;
  }
  .${cls} .img-stack-landscape > p,
  .${cls} .img-pair-balanced > p,
  .${cls} .img-pair-portraits > p,
  .${cls} .img-pair-mixed > p {
    transform: none !important;
  }
  /* Mobile: grid becomes 2 columns */
  .${cls} .img-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
    position: static;
    left: auto;
    transform: none;
  }
  .${cls} .img-grid img {
    min-height: 140px !important;
    max-height: 220px !important;
  }
  /* Mobile: mixed grid stacks vertically */
  .${cls} .img-grid-mixed {
    grid-template-columns: 1fr;
    gap: 8px;
    width: 100%;
    position: static;
    left: auto;
    transform: none;
  }
  .${cls} .img-grid-quilt,
  .${cls} .img-grid-balanced {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .${cls} .img-pair-grid,
  .${cls} .img-column-portraits,
  .${cls} .img-editorial-grid,
  .${cls} .img-portrait-triptych,
  .${cls} .img-portrait-quartet {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .${cls} .img-grid-quilt > p,
  .${cls} .img-grid-balanced > p {
    grid-column: auto !important;
  }
  .${cls} .img-pair-grid > p,
  .${cls} .img-column-portraits > p,
  .${cls} .img-editorial-grid > p,
  .${cls} .img-portrait-triptych > p,
  .${cls} .img-portrait-quartet > p {
    grid-column: auto !important;
    grid-row: auto !important;
    width: auto;
    transform: none !important;
  }
  .${cls} .img-grid-quilt img,
  .${cls} .img-grid-balanced img {
    min-height: 150px !important;
    max-height: 220px !important;
  }
  .${cls} .img-portrait-triptych img,
  .${cls} .img-portrait-quartet img {
    min-height: 170px !important;
    max-height: 220px !important;
    height: 170px !important;
  }
  .${cls} .img-grid-mixed-stack {
    flex-direction: row;
    gap: 8px;
  }
  .${cls} .img-grid-mixed-stack img {
    min-height: 120px !important;
    height: 120px !important;
    max-height: 120px !important;
  }
  .${cls} .img-grid-mixed > p img {
    min-height: 200px !important;
    max-height: 240px !important;
    object-fit: contain;
  }
  /* Mobile: portrait row heights */
  .${cls} .img-row-2-portrait img {
    height: 210px !important;
    max-height: 210px !important;
  }
  .${cls} .img-grid-portrait img {
    min-height: 180px;
    max-height: 240px;
  }
.${cls} .instagram-wrapper,
.${cls} .instagram-media {
  width: 100% !important;
  max-width: 100% !important;
}
}

@media (max-width: 420px) {
  .${cls} .img-row-2,
  .${cls} .img-row-2-mixed,
  .${cls} .img-stack-landscape,
  .${cls} .img-pair-balanced,
  .${cls} .img-pair-portraits,
  .${cls} .img-pair-mixed,
  .${cls} .img-grid,
  .${cls} .img-grid-balanced,
  .${cls} .img-grid-quilt,
  .${cls} .img-pair-grid,
  .${cls} .img-column-portraits,
  .${cls} .img-editorial-grid,
  .${cls} .img-portrait-triptych,
  .${cls} .img-portrait-quartet,
  .${cls} .img-grid-portrait {
    grid-template-columns: minmax(0, 1fr) !important;
    width: 100%;
    max-width: 100%;
  }

  .${cls} .img-grid-mixed-stack {
    flex-direction: column;
  }

  .${cls} .img-grid-quilt > p,
  .${cls} .img-pair-grid > p,
  .${cls} .img-column-portraits > p,
  .${cls} .img-editorial-grid > p,
  .${cls} .img-portrait-triptych > p,
  .${cls} .img-portrait-quartet > p {
    grid-column: auto !important;
    grid-row: auto !important;
    width: 100% !important;
    transform: none !important;
  }

  .${cls} .img-row-2 p,
  .${cls} .img-grid p,
  .${cls} .img-grid-quilt > p,
  .${cls} .img-pair-grid > p,
  .${cls} .img-editorial-grid > p {
    aspect-ratio: auto;
    min-height: 0;
  }

  .${cls} .img-row-2 img,
  .${cls} .img-grid img,
  .${cls} .img-grid-quilt img,
  .${cls} .img-pair-grid img,
  .${cls} .img-column-portraits img,
  .${cls} .img-editorial-grid img,
  .${cls} .img-portrait-triptych img,
  .${cls} .img-portrait-quartet img,
  .${cls} .img-grid-portrait img {
    width: 100% !important;
    max-width: 100% !important;
  }
}
`
