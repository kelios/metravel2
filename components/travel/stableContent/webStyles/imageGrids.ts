import type { useThemedColors } from '@/hooks/useTheme'

// Row aspect buckets emitted by utils/richTextImageLayout.ts (jrow-ar-100 … jrow-ar-400).
const rowAspectBucketRules = (cls: string): string => {
  const rules: string[] = []
  for (let bucket = 100; bucket <= 400; bucket += 25) {
    rules.push(`.${cls} .img-jrow.jrow-ar-${bucket} { aspect-ratio: ${bucket / 100}; }`)
  }
  return rules.join('\n')
}

export const imageGridStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => `
/* ===== JUSTIFIED MAGAZINE ROWS ===== */
/* Row height derives from the bucketed sum of image aspect ratios
   (aspect-ratio on the row), so every row spans the full content width.
   Cells take their aspect from --travel-rich-image-aspect set by
   decorateRichImageFrames, so contain-fit fills the frame without bars;
   the .rich-image-frame fill absorbs bucket rounding slivers (#1208).

   #1233: the cell rule below outranks .rich-image-frame (extra .img-jrow class),
   so it has to read the same --travel-rich-image-fill var — otherwise the dominant
   colour useWebEffects puts on the frame never paints and every body photo keeps
   the neutral fill. Every image paragraph lands in a jrow, even a lone one. */
.${cls} .img-jrow {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  margin: 1.6em 0 1.9em;
  clear: both;
  max-height: min(72vh, 680px);
}
${rowAspectBucketRules(cls)}
.${cls} .img-jrow > p {
  margin: 0 !important;
  min-width: 0;
  height: 100%;
  flex: 0 1 auto;
  aspect-ratio: var(--travel-rich-image-aspect, 4 / 3);
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid ${colors.borderLight};
  background: var(--travel-rich-image-fill, ${colors.backgroundSecondary});
  box-shadow: ${colors.boxShadows?.light || 'none'};
}
.${cls} .img-jrow > p img {
  width: 100%;
  height: 100% !important;
  max-width: none;
  max-height: none !important;
  object-fit: contain;
  object-position: center;
  margin: 0 !important;
  border-radius: 14px;
  background: transparent;
}
`
