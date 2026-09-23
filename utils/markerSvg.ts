type DropMarkerOptions = {
  size: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  innerColor?: string;
  innerRadius?: number;
};

const DROP_PATH = 'M12 22s7-4.5 7-12a7 7 0 0 0-14 0c0 7.5 7 12 7 12Z';

export const buildDropMarkerHtml = ({
  size,
  fill,
  stroke = 'rgb(175, 125, 75)',
  strokeWidth = 1,
  innerColor = 'rgb(255, 255, 255)',
  innerRadius = 3,
}: DropMarkerOptions) => {
  return `
    <div style="width:${size}px;height:${size}px;position:relative;">
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="${DROP_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
        <circle cx="12" cy="10" r="${innerRadius}" fill="${innerColor}" />
      </svg>
    </div>
  `;
};

/**
 * #2059: размер цифры на капле — в единицах того же viewBox 24, поэтому номер
 * масштабируется вместе с маркером. Голова капли — круг диаметром 14: одна-две
 * цифры идут крупно, третья и четвёртая мельче, чтобы номер не вылез за круг.
 * Таблицу читает и native WebView (`nativeRoutePointMarkersScript.ts`), поэтому
 * номер там и на web подбирается одним правилом.
 */
export const NUMBERED_DROP_FONT_SIZES: readonly number[] = [8, 8, 6.4, 5.2];

export const numberedDropFontSize = (label: string): number =>
  NUMBERED_DROP_FONT_SIZES[
    Math.min(Math.max(label.length, 1), NUMBERED_DROP_FONT_SIZES.length) - 1
  ];

type NumberedDropMarkerOptions = {
  size: number;
  fill: string;
  stroke: string;
  textColor: string;
  /** Номер уже экранирован или это плейсхолдер шаблона (`{{n}}`). */
  label: string;
  /** Размер цифры в единицах viewBox; строка — плейсхолдер шаблона (`{{fs}}`). */
  fontSize: number | string;
  strokeWidth?: number;
};

/**
 * Капля с номером точки маршрута (#2059). Цвета — в `style`, а не в
 * презентационных атрибутах: у тематических цветов на web значение
 * `var(--color-…)`, а подстановку переменных делает только CSS-декларация.
 */
export const buildNumberedDropMarkerHtml = ({
  size,
  fill,
  stroke,
  textColor,
  label,
  fontSize,
  strokeWidth = 1,
}: NumberedDropMarkerOptions): string =>
  `<div style="width:${size}px;height:${size}px;position:relative;">`
  + `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
  + `<path d="${DROP_PATH}" style="fill:${fill};stroke:${stroke};stroke-width:${strokeWidth}" />`
  + `<text x="12" y="10" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}"`
  + ` font-weight="800" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"`
  + ` style="fill:${textColor}">${label}</text>`
  + '</svg></div>';
