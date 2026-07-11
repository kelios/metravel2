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
    width: 100% !important;
    min-width: min(60vw, 100%) !important;
    max-width: 100% !important;
    max-height: 70vh !important;
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
  /* Mobile descriptions prioritize legibility: justified rows become a
     single-column photo stream, every photo full width at its own ratio. */
  .${cls} .img-jrow {
    flex-direction: column;
    aspect-ratio: auto !important;
    max-height: none;
    height: auto;
    gap: 8px;
    margin: 1.2em 0 1.4em;
  }
  .${cls} .img-jrow > p {
    width: 100%;
    height: auto;
    flex: none;
    aspect-ratio: var(--travel-rich-image-aspect, auto);
  }
  .${cls} .img-jrow > p img {
    height: 100% !important;
    max-height: 70vh !important;
  }
.${cls} .instagram-wrapper,
.${cls} .instagram-media,
.${cls} .ig-lite {
  width: 100% !important;
  max-width: 100% !important;
}
}
`
