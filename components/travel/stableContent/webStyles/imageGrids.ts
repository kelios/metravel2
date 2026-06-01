import type { useThemedColors } from '@/hooks/useTheme'

export const imageGridStyles = (
  colors: ReturnType<typeof useThemedColors>,
  cls: string,
): string => `
/* ===== TWO IMAGES SIDE BY SIDE ===== */
.${cls} .img-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(10px, 1.4vw, 16px);
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0 1.8em;
  clear: both;
  align-items: start;
}
.${cls} .img-row-2 p {
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
.${cls} .img-row-2 img {
  width: 100%;
  height: auto;
  max-height: 320px;
  object-fit: contain;
  object-position: center;
  margin: 0;
  border-radius: 14px;
}

/* ===== TWO IMAGES ROW VARIANTS ===== */
.${cls} .img-row-2-landscape img {
  min-height: 220px !important;
  max-height: 280px !important;
}

.${cls} .img-row-2-balanced {
  gap: 14px;
}

.${cls} .img-row-2-balanced img {
  min-height: 200px !important;
  max-height: 260px !important;
}

.${cls} .img-stack-landscape {
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
}

.${cls} .img-stack-landscape > p:first-child {
  transform: translateY(16px);
}

.${cls} .img-stack-landscape > p:last-child {
  transform: translateY(-16px);
}

.${cls} .img-pair-balanced {
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
}

.${cls} .img-pair-balanced > p:first-child {
  transform: none;
}

.${cls} .img-pair-balanced > p:last-child {
  transform: none;
}

/* Portrait pair - taller images */
.${cls} .img-row-2-portrait img {
  height: 100% !important;
  max-height: none !important;
  aspect-ratio: auto !important;
}

.${cls} .img-pair-portraits {
  width: 100%;
  max-width: 100%;
  grid-template-columns: minmax(0, 1.04fr) minmax(0, 0.96fr);
  justify-content: center;
  gap: 14px;
  align-items: end;
}

.${cls} .img-pair-portraits p {
  align-self: end;
  aspect-ratio: 3 / 4;
}

.${cls} .img-pair-portraits > p:first-child {
  transform: none;
}

.${cls} .img-pair-portraits > p:last-child {
  transform: none;
}

/* Mixed pair - portrait + landscape, auto height to respect aspect ratios */
.${cls} .img-row-2-mixed {
  align-items: start;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  width: 100%;
  max-width: 100%;
}
.${cls} .img-row-2-mixed img {
  height: 240px !important;
  max-height: 260px !important;
  aspect-ratio: auto !important;
  object-fit: contain;
}

.${cls} .img-pair-mixed > p:first-child {
  transform: none;
}

.${cls} .img-pair-mixed > p:last-child {
  transform: none;
}

/* ===== THREE+ IMAGES GRID ===== */
.${cls} .img-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0 1.8em;
  clear: both;
  align-items: stretch;
}
.${cls} .img-grid p {
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
.${cls} .img-grid img {
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

.${cls} .img-grid-balanced {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.${cls} .img-grid-balanced img {
  min-height: 180px !important;
  max-height: 260px !important;
}

.${cls} .img-pair-grid {
  width: 100%;
  max-width: 100%;
  grid-template-columns: minmax(320px, 1fr) minmax(200px, 280px);
  justify-content: center;
  grid-auto-rows: auto;
  gap: 14px;
  align-items: stretch;
}

.${cls} .img-pair-grid > p:nth-child(1) {
  grid-row: 1 / span 2;
  grid-column: 1;
  aspect-ratio: 4 / 5;
}

.${cls} .img-pair-grid > p:nth-child(2) {
  grid-row: 1;
  grid-column: 2;
  transform: none;
  aspect-ratio: 3 / 4;
}

.${cls} .img-pair-grid > p:nth-child(3) {
  grid-row: 2;
  grid-column: 2;
  transform: none;
  aspect-ratio: 3 / 4;
}

.${cls} .img-pair-grid > p:nth-child(4) {
  grid-column: 1 / span 2;
  grid-row: 3;
  width: auto;
  justify-self: stretch;
  aspect-ratio: 16 / 7;
}

.${cls} .img-pair-grid img {
  min-height: 100% !important;
  max-height: none !important;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${cls} .img-grid-quilt {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto auto;
  gap: 14px;
  width: 100%;
  max-width: 100%;
}

.${cls} .img-grid-quilt > p {
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

.${cls} .img-grid-quilt > p:nth-child(1),
.${cls} .img-grid-quilt > p:nth-child(4) {
  aspect-ratio: 16 / 9;
}

.${cls} .img-grid-quilt > p:nth-child(2),
.${cls} .img-grid-quilt > p:nth-child(3) {
  aspect-ratio: 4 / 3;
}

.${cls} .img-quilt-4 {
  margin: 1.6em 0 2em;
}

.${cls} .img-grid-quilt > p:nth-child(1) {
  grid-column: 1 / span 2;
  grid-row: 1;
}

.${cls} .img-grid-quilt > p:nth-child(2) {
  grid-column: 1;
  grid-row: 2;
}

.${cls} .img-grid-quilt > p:nth-child(3) {
  grid-column: 2;
  grid-row: 2;
}

.${cls} .img-grid-quilt > p:nth-child(4) {
  grid-column: 1 / span 2;
  grid-row: 3;
}

.${cls} .img-grid-quilt img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  border-radius: 14px;
}

/* ===== MIXED GRID: 1 portrait + 2 landscape ===== */
/* Layout: [portrait] [landscape stack] OR [landscape stack] [portrait] */
.${cls} .img-grid-mixed {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 14px;
  width: 100%;
  max-width: 100%;
  margin: 1.5em 0 1.8em;
  clear: both;
  align-items: stretch;
}
.${cls} .img-grid-mixed-reverse {
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
}
.${cls} .img-grid-mixed > p {
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
.${cls} .img-grid-mixed > p img {
  width: 100%;
  height: 100% !important;
  min-height: 340px;
  object-fit: contain;
  border-radius: 14px;
}
.${cls} .img-grid-mixed-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.${cls} .img-grid-mixed-stack p {
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
.${cls} .img-grid-mixed-stack img {
  width: 100%;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${cls} .img-quilt-3 {
  margin: 1.6em 0 2em;
}

/* ===== PORTRAIT-HEAVY GRID ===== */
/* Multiple portraits - editorial magazine layout */
.${cls} .img-grid-portrait {
  width: 100%;
  max-width: 100%;
  grid-template-columns: repeat(2, minmax(220px, 280px));
  justify-content: center;
  gap: 14px;
}
.${cls} .img-column-portraits {
  width: 100%;
  max-width: 100%;
  grid-template-columns: repeat(2, minmax(220px, 280px));
  justify-content: center;
  gap: 14px;
}

.${cls} .img-column-portraits > p:nth-child(odd) {
  transform: none;
}

.${cls} .img-column-portraits > p:nth-child(even) {
  transform: none;
}

.${cls} .img-grid-portrait img {
  min-height: 100%;
  max-height: none;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${cls} .img-portrait-triptych {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  grid-template-rows: 1fr 1fr;
  justify-content: center;
  gap: 14px;
  align-items: stretch;
}

.${cls} .img-portrait-triptych > p {
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

.${cls} .img-portrait-triptych > p:nth-child(1) {
  grid-row: 1 / span 2;
  grid-column: 1;
}

.${cls} .img-portrait-triptych > p:nth-child(2) {
  grid-row: 1;
  grid-column: 2;
}

.${cls} .img-portrait-triptych > p:nth-child(3) {
  grid-row: 2;
  grid-column: 2;
}

.${cls} .img-portrait-triptych img {
  width: 100%;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${cls} .img-portrait-quartet {
  width: 100%;
  max-width: 100%;
  grid-template-columns: repeat(2, minmax(220px, 280px));
  justify-content: center;
  grid-auto-rows: 360px;
  gap: 14px clamp(10px, 1.4vw, 18px);
  align-items: stretch;
}

.${cls} .img-portrait-quartet > p:nth-child(1) {
  grid-row: auto;
}

.${cls} .img-portrait-quartet img {
  min-height: 100% !important;
  max-height: none !important;
  height: 100% !important;
  object-fit: contain;
  border-radius: 14px;
}

.${cls} .img-editorial-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: minmax(200px, auto);
  gap: 14px;
}

.${cls} .img-editorial-grid > p {
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

.${cls} .img-editorial-grid img {
  width: 100%;
  height: auto;
  max-height: 100%;
  object-fit: contain;
  border-radius: 14px;
}
`
