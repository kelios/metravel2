import Feather from '@expo/vector-icons/Feather';
import type { ThemedColors } from '@/hooks/useTheme';

export type NavigationActionKind =
  | 'apple'
  | 'google'
  | 'organic'
  | 'osm'
  | 'save'
  | 'telegram'
  | 'waze'
  | 'yandex';

export type NavigationActionVisual = {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  tintBg: string;
};

export const NAVIGATION_ACTION_LABELS: Record<NavigationActionKind, string> = {
  apple: 'Apple',
  google: 'Google',
  organic: 'Organic',
  osm: 'OSM',
  save: 'Сохранить',
  telegram: 'Telegram',
  waze: 'Waze',
  yandex: 'Яндекс',
};

export function resolveNavigationActionKind(
  key?: string | null,
  label?: string | null,
): NavigationActionKind | null {
  const value = `${key ?? ''} ${label ?? ''}`.toLowerCase();

  if (value.includes('google')) return 'google';
  if (value.includes('organic')) return 'organic';
  if (value.includes('waze')) return 'waze';
  if (value.includes('yandex') || value.includes('яндекс')) return 'yandex';
  if (value.includes('telegram')) return 'telegram';
  if (value.includes('apple')) return 'apple';
  if (value.includes('osm') || value.includes('openstreet')) return 'osm';
  if (value.includes('save') || value.includes('сохран') || value.includes('мои точки')) return 'save';

  return null;
}

export function getNavigationActionVisual(
  kind: NavigationActionKind,
  colors: ThemedColors,
): NavigationActionVisual {
  switch (kind) {
    case 'google':
      return { icon: 'map-pin', iconColor: colors.info, tintBg: colors.infoSoft };
    case 'organic':
      return { icon: 'compass', iconColor: colors.successDark, tintBg: colors.successSoft };
    case 'waze':
      return { icon: 'navigation', iconColor: colors.infoDark, tintBg: colors.infoSoft };
    case 'yandex':
      return { icon: 'navigation-2', iconColor: colors.danger, tintBg: colors.dangerSoft };
    case 'telegram':
      return { icon: 'send', iconColor: colors.primary, tintBg: colors.primarySoft };
    case 'apple':
      return { icon: 'map', iconColor: colors.text, tintBg: colors.backgroundSecondary };
    case 'osm':
      return { icon: 'map', iconColor: colors.accentDark, tintBg: colors.accentSoft };
    case 'save':
      return { icon: 'bookmark', iconColor: colors.primary, tintBg: colors.primarySoft };
    default:
      return { icon: 'map-pin', iconColor: colors.textMuted, tintBg: colors.backgroundSecondary };
  }
}
