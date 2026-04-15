import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

export const WEB_RICH_TEXT_CLASS = 'travel-rich-text'
export const WEB_RICH_TEXT_FULL_WIDTH_CLASS = 'travel-rich-text--full-width'
export const WEB_RICH_TEXT_STYLES_ID = 'travel-rich-text-styles'

export const getWebRichTextStyles = (colors: ReturnType<typeof useThemedColors>) => `
.${WEB_RICH_TEXT_CLASS} {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 17px;
  line-height: 1.58;
  letter-spacing: -0.003em;
  color: ${colors.textMuted};
  --travel-rich-breakout-width: min(1080px, calc(100vw - 420px));
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 0 ${DESIGN_TOKENS.spacing.md}px 48px;
  /* Long unbroken tokens (URLs, hashtags, tracking IDs) from user-authored
     HTML would otherwise push a horizontal scrollbar on narrow phones. */
  overflow-wrap: anywhere;
  word-break: break-word;
}

.${WEB_RICH_TEXT_CLASS}.${WEB_RICH_TEXT_FULL_WIDTH_CLASS} {
  max-width: 100%;
  margin: 0;
}

/* ===== APPLE-STYLE PARAGRAPHS ===== */
.${WEB_RICH_TEXT_CLASS} p {
  margin: 0 0 1.4em;
}

/* ===== APPLE-STYLE HEADINGS ===== */
.${WEB_RICH_TEXT_CLASS} h1,
.${WEB_RICH_TEXT_CLASS} h2,
.${WEB_RICH_TEXT_CLASS} h3 {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: ${colors.text};
  font-weight: 600;
  letter-spacing: -0.022em;
}
.${WEB_RICH_TEXT_CLASS} h2 {
  font-size: 28px;
  line-height: 1.14;
  margin: 1.8em 0 0.6em;
}
.${WEB_RICH_TEXT_CLASS} h3 {
  font-size: 21px;
  line-height: 1.19;
  margin: 1.6em 0 0.5em;
}

/* ===== BASE IMAGES ===== */
.${WEB_RICH_TEXT_CLASS} img {
  display: block;
  max-width: min(100%, 72vw);
  max-height: 55vh;
  height: auto;
  object-fit: contain;
  object-position: center;
  border-radius: 14px;
  background: transparent;
  cursor: zoom-in;
  margin-top: 1.2em;
  margin-bottom: 1.2em;
}

.${WEB_RICH_TEXT_CLASS} p > img + img,
.${WEB_RICH_TEXT_CLASS} p > img + br + img,
.${WEB_RICH_TEXT_CLASS} p > br + img {
  margin-top: 18px !important;
}

.${WEB_RICH_TEXT_CLASS} p + img,
.${WEB_RICH_TEXT_CLASS} img + p {
  margin-top: 1.6em;
}

.${WEB_RICH_TEXT_CLASS} .rich-image-frame {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: ${colors.backgroundSecondary};
}

.${WEB_RICH_TEXT_CLASS} .rich-image-frame::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--travel-rich-image);
  background-size: cover;
  background-position: center;
  filter: blur(18px) saturate(1.06);
  transform: scale(1.08);
  opacity: 0.9;
  z-index: 0;
}

.${WEB_RICH_TEXT_CLASS} .rich-image-frame > img,
.${WEB_RICH_TEXT_CLASS} .rich-image-frame > a,
.${WEB_RICH_TEXT_CLASS} .rich-image-frame > figcaption {
  position: relative;
  z-index: 1;
}

.${WEB_RICH_TEXT_CLASS} .rich-image-frame > img {
  background: transparent;
}

/* ===== SINGLE WIDE IMAGE (horizontal/landscape) ===== */
.${WEB_RICH_TEXT_CLASS} .img-single-wide {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 1.6em 0 1.8em;
  clear: both;
  text-align: center;
}
.${WEB_RICH_TEXT_CLASS} .img-single-wide img {
  width: min(100%, 74vw);
  max-width: min(100%, 74vw);
  max-height: 52vh;
  height: auto;
  margin: 0 auto;
  border-radius: 16px;
  object-fit: contain;
  box-shadow: ${colors.boxShadows?.light || 'none'};
}

.${WEB_RICH_TEXT_CLASS} .figure-landscape {
  margin: 1.8em 0 2em;
}

.${WEB_RICH_TEXT_CLASS} .figure-landscape img {
  width: min(100%, 76vw);
  max-width: min(100%, 76vw);
  max-height: 50vh;
}

/* ===== SINGLE IMAGE WITH FLOAT (desktop, vertical/square images only) ===== */
@media (min-width: 769px) {
  .${WEB_RICH_TEXT_CLASS} .img-float-right {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    max-width: 100%;
    margin: 1.4em 0 1.6em;
    clear: both;
  }
  .${WEB_RICH_TEXT_CLASS} .img-float-right img {
    width: clamp(260px, 52%, 420px);
    max-height: 48vh;
    object-fit: contain;
    margin: 0;
    border-radius: 16px;
    box-shadow: ${colors.boxShadows?.light || 'none'};
  }
  .${WEB_RICH_TEXT_CLASS} .img-float-left {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    max-width: 100%;
    margin: 1.4em 0 1.6em;
    clear: both;
  }
  .${WEB_RICH_TEXT_CLASS} .img-float-left img {
    width: clamp(260px, 52%, 420px);
    max-height: 48vh;
    object-fit: contain;
    margin: 0;
    border-radius: 16px;
    box-shadow: ${colors.boxShadows?.light || 'none'};
  }

  .${WEB_RICH_TEXT_CLASS} .figure-portrait {
    margin: 1.6em 0 1.8em;
  }

  .${WEB_RICH_TEXT_CLASS} .figure-portrait.img-float-right {
    padding-left: clamp(24px, 5vw, 64px);
  }

  .${WEB_RICH_TEXT_CLASS} .figure-portrait.img-float-left {
    padding-right: clamp(24px, 5vw, 64px);
  }

  .${WEB_RICH_TEXT_CLASS} .figure-portrait img {
    width: clamp(280px, 56%, 440px);
    max-width: min(100%, 440px);
    max-height: min(48vh, 520px);
  }
}

/* ===== TWO IMAGES SIDE BY SIDE ===== */
.${WEB_RICH_TEXT_CLASS} .img-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(10px, 1.4vw, 16px);
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0 1.8em;
  clear: both;
  align-items: start;
}
.${WEB_RICH_TEXT_CLASS} .img-row-2 p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  justify-self: stretch;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
  box-shadow: ${colors.boxShadows?.light || 'none'};
}
.${WEB_RICH_TEXT_CLASS} .img-row-2 img {
  width: 100%;
  height: auto;
  max-height: 320px;
  object-fit: contain;
  object-position: center;
  margin: 0;
  border-radius: 14px;
}

/* ===== TWO IMAGES ROW VARIANTS ===== */
.${WEB_RICH_TEXT_CLASS} .img-row-2-landscape img {
  min-height: 220px !important;
  max-height: 280px !important;
}

.${WEB_RICH_TEXT_CLASS} .img-row-2-balanced {
  gap: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-row-2-balanced img {
  min-height: 200px !important;
  max-height: 260px !important;
}

.${WEB_RICH_TEXT_CLASS} .img-stack-landscape {
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
}

.${WEB_RICH_TEXT_CLASS} .img-stack-landscape > p:first-child {
  transform: translateY(16px);
}

.${WEB_RICH_TEXT_CLASS} .img-stack-landscape > p:last-child {
  transform: translateY(-16px);
}

.${WEB_RICH_TEXT_CLASS} .img-pair-balanced {
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
}

.${WEB_RICH_TEXT_CLASS} .img-pair-balanced > p:first-child {
  transform: none;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-balanced > p:last-child {
  transform: none;
}

/* Portrait pair - taller images */
.${WEB_RICH_TEXT_CLASS} .img-row-2-portrait img {
  height: 100% !important;
  max-height: none !important;
  aspect-ratio: auto !important;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-portraits {
  width: 100%;
  max-width: 100%;
  grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);
  justify-content: center;
  gap: 14px;
  align-items: end;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-portraits p {
  align-self: end;
  aspect-ratio: 3 / 4;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-portraits > p:first-child {
  transform: none;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-portraits > p:last-child {
  transform: none;
}

/* Mixed pair - portrait + landscape, auto height to respect aspect ratios */
.${WEB_RICH_TEXT_CLASS} .img-row-2-mixed {
  align-items: start;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  width: 100%;
  max-width: 100%;
}
.${WEB_RICH_TEXT_CLASS} .img-row-2-mixed img {
  height: 240px !important;
  max-height: 260px !important;
  aspect-ratio: auto !important;
  object-fit: contain;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-mixed > p:first-child {
  transform: none;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-mixed > p:last-child {
  transform: none;
}

/* ===== THREE+ IMAGES GRID ===== */
.${WEB_RICH_TEXT_CLASS} .img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0 1.8em;
  clear: both;
  align-items: stretch;
}
.${WEB_RICH_TEXT_CLASS} .img-grid p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  justify-self: stretch;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
  box-shadow: ${colors.boxShadows?.light || 'none'};
  aspect-ratio: 4 / 5;
}
.${WEB_RICH_TEXT_CLASS} .img-grid img {
  width: 100%;
  height: 100% !important;
  min-height: 180px !important;
  max-height: none !important;
  aspect-ratio: auto !important;
  object-fit: contain;
  object-position: center;
  margin: 0;
  border-radius: 14px;
  background: transparent;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-balanced {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-balanced img {
  min-height: 180px !important;
  max-height: 260px !important;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-grid {
  width: 100%;
  max-width: 100%;
  grid-template-columns: minmax(320px, 1fr) minmax(200px, 280px);
  justify-content: center;
  grid-auto-rows: auto;
  gap: 14px;
  align-items: stretch;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-grid > p:nth-child(1) {
  grid-row: 1 / span 2;
  grid-column: 1;
  aspect-ratio: 4 / 5;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-grid > p:nth-child(2) {
  grid-row: 1;
  grid-column: 2;
  transform: none;
  aspect-ratio: 3 / 4;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-grid > p:nth-child(3) {
  grid-row: 2;
  grid-column: 2;
  transform: none;
  aspect-ratio: 3 / 4;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-grid > p:nth-child(4) {
  grid-column: 1 / span 2;
  grid-row: 3;
  width: auto;
  justify-self: stretch;
  aspect-ratio: 16 / 7;
}

.${WEB_RICH_TEXT_CLASS} .img-pair-grid img {
  min-height: 100% !important;
  max-height: none !important;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto auto;
  gap: 14px;
  width: 100%;
  max-width: 100%;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  justify-self: stretch;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: ${colors.backgroundSecondary};
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(1),
.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(4) {
  aspect-ratio: 16 / 9;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(2),
.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(3) {
  aspect-ratio: 4 / 3;
}

.${WEB_RICH_TEXT_CLASS} .img-quilt-4 {
  margin: 1.6em 0 2em;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(1) {
  grid-column: 1 / span 2;
  grid-row: 1;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(2) {
  grid-column: 1;
  grid-row: 2;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(3) {
  grid-column: 2;
  grid-row: 2;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p:nth-child(4) {
  grid-column: 1 / span 2;
  grid-row: 3;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-quilt img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  border-radius: 14px;
}

/* ===== MIXED GRID: 1 portrait + 2 landscape ===== */
/* Layout: [portrait] [landscape stack] OR [landscape stack] [portrait] */
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 14px;
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0 1.8em;
  clear: both;
  align-items: stretch;
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed-reverse {
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed > p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  justify-self: stretch;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
  box-shadow: ${colors.boxShadows?.light || 'none'};
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed > p img {
  width: 100%;
  height: 100% !important;
  min-height: 340px;
  object-fit: contain;
  border-radius: 14px;
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  min-height: 160px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: ${colors.backgroundSecondary};
  box-shadow: ${colors.boxShadows?.light || 'none'};
}
.${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack img {
  width: 100%;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-quilt-3 {
  margin: 1.6em 0 2em;
}

/* ===== PORTRAIT-HEAVY GRID ===== */
/* Multiple portraits - editorial magazine layout */
.${WEB_RICH_TEXT_CLASS} .img-grid-portrait {
  width: 100%;
  max-width: 100%;
  grid-template-columns: repeat(2, minmax(220px, 280px));
  justify-content: center;
  gap: 14px;
}
.${WEB_RICH_TEXT_CLASS} .img-column-portraits {
  width: 100%;
  max-width: 100%;
  grid-template-columns: repeat(2, minmax(220px, 280px));
  justify-content: center;
  gap: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-column-portraits > p:nth-child(odd) {
  transform: none;
}

.${WEB_RICH_TEXT_CLASS} .img-column-portraits > p:nth-child(even) {
  transform: none;
}

.${WEB_RICH_TEXT_CLASS} .img-grid-portrait img {
  min-height: 100%;
  max-height: none;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-triptych {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  grid-template-rows: 1fr 1fr;
  justify-content: center;
  gap: 14px;
  align-items: stretch;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-triptych > p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: ${colors.backgroundSecondary};
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-triptych > p:nth-child(1) {
  grid-row: 1 / span 2;
  grid-column: 1;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-triptych > p:nth-child(2) {
  grid-row: 1;
  grid-column: 2;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-triptych > p:nth-child(3) {
  grid-row: 2;
  grid-column: 2;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-triptych img {
  width: 100%;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-quartet {
  width: 100%;
  max-width: 100%;
  grid-template-columns: repeat(2, minmax(220px, 280px));
  justify-content: center;
  grid-auto-rows: 360px;
  gap: 14px clamp(10px, 1.4vw, 18px);
  align-items: stretch;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-quartet > p:nth-child(1) {
  grid-row: auto;
}

.${WEB_RICH_TEXT_CLASS} .img-portrait-quartet img {
  min-height: 100% !important;
  max-height: none !important;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-editorial-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: minmax(200px, auto);
  gap: 14px;
}

.${WEB_RICH_TEXT_CLASS} .img-editorial-grid > p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  justify-self: stretch;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: ${colors.backgroundSecondary};
  aspect-ratio: 4 / 3;
}

.${WEB_RICH_TEXT_CLASS} .img-editorial-grid img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  border-radius: 14px;
}

/* ===== CLEARFIX ===== */
.${WEB_RICH_TEXT_CLASS}::after {
  content: "";
  display: block;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} h2,
.${WEB_RICH_TEXT_CLASS} h3 {
  clear: both;
}

/* ===== FIGURE IMAGES ===== */
.${WEB_RICH_TEXT_CLASS} figure img {
  float: none !important;
  max-width: 100%;
  width: 100%;
  margin: 0.5em auto;
}

/* ===== APPLE-STYLE LINKS ===== */
.${WEB_RICH_TEXT_CLASS} a {
  color: ${colors.primaryText};
  text-decoration: none;
  word-break: break-word;
  transition: opacity 0.2s;
}
.${WEB_RICH_TEXT_CLASS} a:hover {
  text-decoration: underline;
}
.${WEB_RICH_TEXT_CLASS} a img {
  cursor: pointer;
}
.${WEB_RICH_TEXT_CLASS} a:focus-visible {
  outline: 2px solid ${colors.focusStrong};
  outline-offset: 2px;
  border-radius: 4px;
}

/* ===== LISTS ===== */
.${WEB_RICH_TEXT_CLASS} ul,
.${WEB_RICH_TEXT_CLASS} ol {
  margin: 1.2em 0 1.5em 2em;
  padding: 0;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} li {
  margin-bottom: 0.5em;
  line-height: 1.7;
}
.${WEB_RICH_TEXT_CLASS} li::marker {
  color: ${colors.primary};
}

/* ===== APPLE-STYLE BLOCKQUOTES ===== */
.${WEB_RICH_TEXT_CLASS} blockquote {
  margin: 1.8em 0;
  padding: 0 0 0 1.5em;
  border-left: 3px solid ${colors.border};
  font-size: 17px;
  line-height: 1.58;
  color: ${colors.textMuted};
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} blockquote p {
  margin-bottom: 0.75em;
}
.${WEB_RICH_TEXT_CLASS} blockquote p:last-child {
  margin-bottom: 0;
}

/* ===== PREMIUM FIGURES & CAPTIONS ===== */
.${WEB_RICH_TEXT_CLASS} figure {
  margin: 1.8em 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} figure img {
  margin-bottom: 1em;
}
.${WEB_RICH_TEXT_CLASS} figcaption {
  text-align: center;
  font-size: 0.85rem;
  color: ${colors.textMuted};
  font-style: italic;
  margin-top: 0.75em;
  padding: 0 2em;
  line-height: 1.5;
}

/* ===== IMAGE STRIPS ===== */
.${WEB_RICH_TEXT_CLASS} .image-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${DESIGN_TOKENS.spacing.sm}px;
  margin: 1.5em 0;
  clear: both;
}
.${WEB_RICH_TEXT_CLASS} .image-strip img {
  float: none;
  width: 100%;
  max-width: 100%;
  margin: 0;
  border-radius: 8px;
}

/* ===== MEDIA EMBEDS ===== */
.${WEB_RICH_TEXT_CLASS} iframe,
.${WEB_RICH_TEXT_CLASS} .yt-lite {
  display: block;
  max-width: 100%;
  border-radius: ${DESIGN_TOKENS.radii.md}px;
  padding: 0;
  overflow: hidden;
  margin: 1.5em 0;
  clear: both;
}

/* ===== CLEARFIX ===== */
.${WEB_RICH_TEXT_CLASS}::after {
  content: "";
  display: block;
  clear: both;
}
/* Instagram wrapper - обёртка для всех Instagram embed'ов */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper,
.${WEB_RICH_TEXT_CLASS} .instagram-media {
  width: min(100%, 430px) !important;
  max-width: 430px !important;
  min-width: 0 !important;
  margin: ${DESIGN_TOKENS.spacing.md}px auto ${DESIGN_TOKENS.spacing.lg}px !important;
  border-radius: 22px !important;
  overflow: hidden !important;
  position: relative;
  display: block;
  border: 1px solid ${colors.borderLight};
  background: ${colors.surfaceMuted};
  box-shadow: ${colors.boxShadows?.light || 'none'};
}

/* Instagram iframe - занимает всю ширину, пропорциональная высота */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper iframe,
.${WEB_RICH_TEXT_CLASS} .instagram-embed,
.${WEB_RICH_TEXT_CLASS} .instagram-media iframe,
.${WEB_RICH_TEXT_CLASS} iframe.ql-video[src*="instagram.com"],
.${WEB_RICH_TEXT_CLASS} iframe[src*="instagram.com"] {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  min-height: 0 !important;
  aspect-ratio: 4 / 5 !important;
  border: none !important;
  border-radius: 18px !important;
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

/* Скрытие лишних элементов внутри Instagram embed через CSS */
/* Примечание: из-за CORS мы не можем напрямую изменять содержимое iframe,
   но можем использовать CSS для скрытия элементов, которые рендерятся поверх iframe */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper::before,
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper::after {
  display: none !important;
}

/* Попытка скрыть элементы, которые могут рендериться поверх iframe */
/* Эти стили применяются к элементам, которые Instagram может добавить в DOM */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper + *,
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper ~ * {
  /* Скрываем элементы после wrapper, которые могут быть добавлены Instagram скриптом */
}

/* Убираем лишние отступы и границы */
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper {
  background: ${colors.surface} !important;
  padding: 0 !important;
}

/* ===== MOBILE RESPONSIVE ===== */
@media (max-width: 768px) {
  .${WEB_RICH_TEXT_CLASS} {
    font-size: 17px;
    line-height: 1.52;
    --travel-rich-breakout-width: 100%;
    padding: 0 ${DESIGN_TOKENS.spacing.sm}px 32px;
  }
  .${WEB_RICH_TEXT_CLASS} img {
    border-radius: 10px;
  }
  .${WEB_RICH_TEXT_CLASS} h2 {
    font-size: 24px;
    margin: 1.5em 0 0.5em;
  }
  .${WEB_RICH_TEXT_CLASS} h3 {
    font-size: 19px;
    margin: 1.4em 0 0.4em;
  }
  .${WEB_RICH_TEXT_CLASS} blockquote {
    margin: 1.5em 0;
    padding: 0 0 0 1em;
  }
  /* Mobile: no float, stack images */
  .${WEB_RICH_TEXT_CLASS} .img-float-right,
  .${WEB_RICH_TEXT_CLASS} .img-float-left {
    float: none;
    max-width: 100%;
    margin: 1em 0;
    padding-left: 0;
    padding-right: 0;
  }
  /* Mobile: 2 images still side by side but smaller */
  .${WEB_RICH_TEXT_CLASS} .img-row-2 {
    width: 100%;
    position: static;
    left: auto;
    transform: none;
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-row-2 img {
    height: 150px !important;
    max-height: 150px !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-row-2-landscape img,
  .${WEB_RICH_TEXT_CLASS} .img-row-2-balanced img {
    height: 160px !important;
    max-height: 160px !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-row-2-mixed {
    grid-template-columns: 1fr 1fr;
  }
  .${WEB_RICH_TEXT_CLASS} .img-stack-landscape,
  .${WEB_RICH_TEXT_CLASS} .img-pair-balanced,
  .${WEB_RICH_TEXT_CLASS} .img-pair-portraits,
  .${WEB_RICH_TEXT_CLASS} .img-pair-mixed {
    width: 100%;
    grid-template-columns: 1fr 1fr;
  }
  .${WEB_RICH_TEXT_CLASS} .img-stack-landscape > p,
  .${WEB_RICH_TEXT_CLASS} .img-pair-balanced > p,
  .${WEB_RICH_TEXT_CLASS} .img-pair-portraits > p,
  .${WEB_RICH_TEXT_CLASS} .img-pair-mixed > p {
    transform: none !important;
  }
  /* Mobile: grid becomes 2 columns */
  .${WEB_RICH_TEXT_CLASS} .img-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
    position: static;
    left: auto;
    transform: none;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid img {
    min-height: 140px !important;
    max-height: 220px !important;
  }
  /* Mobile: mixed grid stacks vertically */
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed {
    grid-template-columns: 1fr;
    gap: 8px;
    width: 100%;
    position: static;
    left: auto;
    transform: none;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-quilt,
  .${WEB_RICH_TEXT_CLASS} .img-grid-balanced {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-pair-grid,
  .${WEB_RICH_TEXT_CLASS} .img-column-portraits,
  .${WEB_RICH_TEXT_CLASS} .img-editorial-grid,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-triptych,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-quartet {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p,
  .${WEB_RICH_TEXT_CLASS} .img-grid-balanced > p {
    grid-column: auto !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-pair-grid > p,
  .${WEB_RICH_TEXT_CLASS} .img-column-portraits > p,
  .${WEB_RICH_TEXT_CLASS} .img-editorial-grid > p,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-triptych > p,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-quartet > p {
    grid-column: auto !important;
    grid-row: auto !important;
    width: auto;
    transform: none !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-quilt img,
  .${WEB_RICH_TEXT_CLASS} .img-grid-balanced img {
    min-height: 150px !important;
    max-height: 220px !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-portrait-triptych img,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-quartet img {
    min-height: 170px !important;
    max-height: 220px !important;
    height: 170px !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack {
    flex-direction: row;
    gap: 8px;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack img {
    min-height: 120px !important;
    height: 120px !important;
    max-height: 120px !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed > p img {
    min-height: 200px !important;
    max-height: 240px !important;
    object-fit: contain;
  }
  /* Mobile: portrait row heights */
  .${WEB_RICH_TEXT_CLASS} .img-row-2-portrait img {
    height: 210px !important;
    max-height: 210px !important;
  }
  .${WEB_RICH_TEXT_CLASS} .img-grid-portrait img {
    min-height: 180px;
    max-height: 240px;
  }
.${WEB_RICH_TEXT_CLASS} .instagram-wrapper,
.${WEB_RICH_TEXT_CLASS} .instagram-media {
  width: 100% !important;
  max-width: 100% !important;
}
}

@media (max-width: 420px) {
  .${WEB_RICH_TEXT_CLASS} .img-row-2,
  .${WEB_RICH_TEXT_CLASS} .img-row-2-mixed,
  .${WEB_RICH_TEXT_CLASS} .img-stack-landscape,
  .${WEB_RICH_TEXT_CLASS} .img-pair-balanced,
  .${WEB_RICH_TEXT_CLASS} .img-pair-portraits,
  .${WEB_RICH_TEXT_CLASS} .img-pair-mixed,
  .${WEB_RICH_TEXT_CLASS} .img-grid,
  .${WEB_RICH_TEXT_CLASS} .img-grid-balanced,
  .${WEB_RICH_TEXT_CLASS} .img-grid-quilt,
  .${WEB_RICH_TEXT_CLASS} .img-pair-grid,
  .${WEB_RICH_TEXT_CLASS} .img-column-portraits,
  .${WEB_RICH_TEXT_CLASS} .img-editorial-grid,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-triptych,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-quartet,
  .${WEB_RICH_TEXT_CLASS} .img-grid-portrait {
    grid-template-columns: minmax(0, 1fr) !important;
    width: 100%;
    max-width: 100%;
  }

  .${WEB_RICH_TEXT_CLASS} .img-grid-mixed-stack {
    flex-direction: column;
  }

  .${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p,
  .${WEB_RICH_TEXT_CLASS} .img-pair-grid > p,
  .${WEB_RICH_TEXT_CLASS} .img-column-portraits > p,
  .${WEB_RICH_TEXT_CLASS} .img-editorial-grid > p,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-triptych > p,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-quartet > p {
    grid-column: auto !important;
    grid-row: auto !important;
    width: 100% !important;
    transform: none !important;
  }

  .${WEB_RICH_TEXT_CLASS} .img-row-2 p,
  .${WEB_RICH_TEXT_CLASS} .img-grid p,
  .${WEB_RICH_TEXT_CLASS} .img-grid-quilt > p,
  .${WEB_RICH_TEXT_CLASS} .img-pair-grid > p,
  .${WEB_RICH_TEXT_CLASS} .img-editorial-grid > p {
    aspect-ratio: auto;
    min-height: 0;
  }

  .${WEB_RICH_TEXT_CLASS} .img-row-2 img,
  .${WEB_RICH_TEXT_CLASS} .img-grid img,
  .${WEB_RICH_TEXT_CLASS} .img-grid-quilt img,
  .${WEB_RICH_TEXT_CLASS} .img-pair-grid img,
  .${WEB_RICH_TEXT_CLASS} .img-column-portraits img,
  .${WEB_RICH_TEXT_CLASS} .img-editorial-grid img,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-triptych img,
  .${WEB_RICH_TEXT_CLASS} .img-portrait-quartet img,
  .${WEB_RICH_TEXT_CLASS} .img-grid-portrait img {
    width: 100% !important;
    max-width: 100% !important;
  }
}

/* Стили для подписей Instagram */
.${WEB_RICH_TEXT_CLASS} .instagram-caption {
  font-size: 14px;
  color: ${colors.textMuted};
  line-height: 1.5;
  width: min(100%, 430px);
  margin: 10px auto 22px;
  text-align: center;
}
.${WEB_RICH_TEXT_CLASS} .instagram-caption-text {
  display: inline;
}
`
