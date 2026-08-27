import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

export const typographyStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => `
/* ===== CLEARFIX ===== */
.${cls}::after {
  content: "";
  display: block;
  clear: both;
}
.${cls} h1,
.${cls} h2,
.${cls} h3,
.${cls} h4,
.${cls} h5,
.${cls} h6,
.${cls} > div,
.${cls} table,
.${cls} pre,
.${cls} hr {
  clear: both;
}

/* ===== FIGURE IMAGES ===== */
.${cls} figure img {
  float: none !important;
  max-width: 100%;
  width: 100%;
  margin: 0.5em auto;
}

/* ===== APPLE-STYLE LINKS ===== */
.${cls} a {
  color: ${colors.primaryText};
  text-decoration: none;
  word-break: break-word;
  transition: opacity 0.2s;
}
.${cls} a:hover {
  text-decoration: underline;
}
.${cls} a img {
  cursor: pointer;
}
.${cls} a:focus-visible {
  outline: 2px solid ${colors.focusStrong};
  outline-offset: 2px;
  border-radius: 4px;
}

/* ===== LISTS ===== */
.${cls} ul,
.${cls} ol {
  margin: 1.2em 0 1.5em 2em;
  padding: 0;
  clear: both;
}
.${cls} li {
  margin-bottom: 0.5em;
  line-height: 1.7;
}
.${cls} li.ql-indent-1 {
  margin-left: 1.5em;
}
.${cls} li.ql-indent-2 {
  margin-left: 3em;
}
.${cls} li.ql-indent-3 {
  margin-left: 4.5em;
}
.${cls} li::marker {
  color: ${colors.primary};
}

/* ===== APPLE-STYLE BLOCKQUOTES ===== */
.${cls} blockquote {
  margin: 1.8em 0;
  padding: 0 0 0 1.5em;
  border-left: 3px solid ${colors.border};
  font-size: 17px;
  line-height: 1.58;
  color: ${colors.textMuted};
  clear: both;
}
.${cls} blockquote p {
  margin-bottom: 0.75em;
}
.${cls} blockquote p:last-child {
  margin-bottom: 0;
}

/* ===== PREMIUM FIGURES & CAPTIONS ===== */
.${cls} figure {
  margin: 1.8em 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  clear: both;
}
.${cls} figure img {
  margin-bottom: 1em;
}
.${cls} figcaption {
  text-align: center;
  font-size: 0.85rem;
  color: ${colors.textMuted};
  font-style: italic;
  margin-top: 0.75em;
  padding: 0 2em;
  line-height: 1.5;
}

/* ===== FAQ / DISCLOSURE ===== */
.${cls} details {
  margin: 0.8em 0;
  border: 1px solid ${colors.border};
  border-radius: ${DESIGN_TOKENS.radii.md}px;
  background: ${colors.surface};
  overflow: hidden;
  clear: both;
}
.${cls} summary {
  min-height: 48px;
  box-sizing: border-box;
  padding: ${DESIGN_TOKENS.spacing.sm}px ${DESIGN_TOKENS.spacing.md}px;
  color: ${colors.text};
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${DESIGN_TOKENS.spacing.sm}px;
  list-style: none;
}
.${cls} summary::-webkit-details-marker {
  display: none;
}
.${cls} summary::after {
  content: "";
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-right: 2px solid ${colors.primary};
  border-bottom: 2px solid ${colors.primary};
  transform: rotate(45deg);
  transition: transform 0.18s ease;
}
.${cls} details[open] summary::after {
  transform: rotate(225deg);
}
.${cls} summary:focus-visible {
  outline: 2px solid ${colors.focusStrong};
  outline-offset: -2px;
}
.${cls} details > :not(summary) {
  margin-left: ${DESIGN_TOKENS.spacing.md}px;
  margin-right: ${DESIGN_TOKENS.spacing.md}px;
}
.${cls} details > summary + * {
  border-top: 1px solid ${colors.borderLight};
  padding-top: ${DESIGN_TOKENS.spacing.sm}px;
}

/* ===== IMAGE STRIPS ===== */
.${cls} .image-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${DESIGN_TOKENS.spacing.sm}px;
  margin: 1.5em 0;
  clear: both;
}
.${cls} .image-strip img {
  float: none;
  width: 100%;
  max-width: 100%;
  margin: 0;
  border-radius: 8px;
}

/* ===== MEDIA EMBEDS ===== */
.${cls} iframe,
.${cls} .yt-lite {
  display: block;
  max-width: 100%;
  border-radius: ${DESIGN_TOKENS.radii.md}px;
  padding: 0;
  overflow: hidden;
  margin: 1.5em 0;
  clear: both;
}
`
