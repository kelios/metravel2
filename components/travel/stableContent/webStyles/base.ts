import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

export const baseStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
  fullCls: string,
): string => `
.${cls} {
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

.${cls}.${fullCls} {
  max-width: 100%;
  margin: 0;
}

/* ===== APPLE-STYLE PARAGRAPHS ===== */
.${cls} p {
  margin: 0 0 1.4em;
}

/* ===== APPLE-STYLE HEADINGS ===== */
.${cls} h1,
.${cls} h2,
.${cls} h3 {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: ${colors.text};
  font-weight: 600;
  letter-spacing: -0.022em;
}
.${cls} h2 {
  font-size: 28px;
  line-height: 1.14;
  margin: 1.8em 0 0.6em;
}
.${cls} h3 {
  font-size: 21px;
  line-height: 1.19;
  margin: 1.6em 0 0.5em;
}

/* ===== BASE IMAGES ===== */
.${cls} img {
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

.${cls} p > img + img,
.${cls} p > img + br + img,
.${cls} p > br + img {
  margin-top: 18px !important;
}

.${cls} p + img,
.${cls} img + p {
  margin-top: 1.6em;
}

.${cls} .rich-image-frame {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: ${colors.backgroundSecondary};
}

.${cls} .rich-image-frame::before {
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

.${cls} .rich-image-frame > img,
.${cls} .rich-image-frame > a,
.${cls} .rich-image-frame > figcaption {
  position: relative;
  z-index: 1;
}

.${cls} .rich-image-frame > img {
  background: transparent;
}
`
