import { Platform, StyleSheet } from 'react-native';

const PATCH_FLAG = '__metravel_web_shadow_patch_v1__';

type AnyStyle = Record<string, any>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const toRgba = (color: unknown, opacity: number): string => {
  const safeOpacity = clamp01(opacity);
  const raw = String(color ?? 'rgb(0, 0, 0)').trim();

  const hex = raw.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
  if (hex) {
    const value = hex[1];
    const normalized = value.length === 3
      ? value.split('').map((ch) => ch + ch).join('')
      : value;
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${safeOpacity})`;
  }

  const rgb = raw.match(/^rgb\s*\(([^)]+)\)$/i);
  if (rgb) return raw.replace(/^rgb/i, 'rgba').replace(/\)\s*$/, `, ${safeOpacity})`);

  const rgba = raw.match(/^rgba\s*\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${safeOpacity})`;
    }
  }

  return `rgba(0, 0, 0, ${safeOpacity})`;
};

const sanitizeStyleObject = (style: AnyStyle): AnyStyle => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style;

  const hasDeprecatedBoxShadow =
    'shadowColor' in style ||
    'shadowOffset' in style ||
    'shadowOpacity' in style ||
    'shadowRadius' in style ||
    'elevation' in style;
  const hasDeprecatedTextShadow =
    'textShadowColor' in style ||
    'textShadowOffset' in style ||
    'textShadowRadius' in style;

  if (!hasDeprecatedBoxShadow && !hasDeprecatedTextShadow) return style;

  const next: AnyStyle = { ...style };

  if (hasDeprecatedBoxShadow) {
    const offset = style.shadowOffset ?? {};
    const offsetX = Number(offset.width ?? 0);
    const offsetY = Number(offset.height ?? 0);
    const blur = Number(style.shadowRadius ?? (style.elevation ? style.elevation * 1.5 : 0));
    const opacity = Number(style.shadowOpacity ?? (style.elevation ? 0.18 : 0));

    if (!next.boxShadow && (blur > 0 || offsetX !== 0 || offsetY !== 0 || opacity > 0)) {
      next.boxShadow = `${offsetX}px ${offsetY}px ${Math.max(0, blur)}px ${toRgba(style.shadowColor, opacity)}`;
    }

    delete next.shadowColor;
    delete next.shadowOffset;
    delete next.shadowOpacity;
    delete next.shadowRadius;
    delete next.elevation;
  }

  if (hasDeprecatedTextShadow) {
    const textOffset = style.textShadowOffset ?? {};
    const textOffsetX = Number(textOffset.width ?? 0);
    const textOffsetY = Number(textOffset.height ?? 0);
    const textBlur = Math.max(0, Number(style.textShadowRadius ?? 0));
    const textColor = String(style.textShadowColor ?? 'rgba(0, 0, 0, 0.35)');
    const hasVisibleTextShadow =
      textBlur > 0 ||
      textOffsetX !== 0 ||
      textOffsetY !== 0 ||
      textColor !== 'transparent';

    if (!next.textShadow && hasVisibleTextShadow) {
      next.textShadow = `${textOffsetX}px ${textOffsetY}px ${textBlur}px ${textColor}`;
    }

    delete next.textShadowColor;
    delete next.textShadowOffset;
    delete next.textShadowRadius;
  }

  return next;
};

const sanitizeStylesMap = (styles: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {};
  for (const key of Object.keys(styles)) {
    result[key] = sanitizeStyleObject(styles[key]);
  }
  return result;
};

export const patchWebShadowStyles = () => {
  if (Platform.OS !== 'web') return;

  const globalScope = globalThis as Record<string, unknown>;
  if (globalScope[PATCH_FLAG]) return;

  const originalCreate = StyleSheet.create.bind(StyleSheet);
  const originalFlatten = StyleSheet.flatten.bind(StyleSheet);

  StyleSheet.create = ((styles: Record<string, any>) => {
    return originalCreate(sanitizeStylesMap(styles));
  }) as typeof StyleSheet.create;

  StyleSheet.flatten = ((style: any) => {
    const flattened = originalFlatten(style);
    if (Array.isArray(flattened)) return flattened.map((item) => sanitizeStyleObject(item));
    return sanitizeStyleObject(flattened as AnyStyle);
  }) as typeof StyleSheet.flatten;

  globalScope[PATCH_FLAG] = true;
};
