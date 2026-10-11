import type { ReactNode } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { SEASONAL_THEMES, type SeasonalThemePreference } from '@/constants/seasonalThemes';
import { translate as i18nT } from '@/i18n'


export interface SeasonalThemeOption {
  value: SeasonalThemePreference;
  label: string;
  description: string;
  renderIcon: (size: number, color: string) => ReactNode;
}

type SeasonalIconName = keyof typeof Feather.glyphMap;

const renderIcon = (name: SeasonalIconName) => (size: number, color: string) => (
  <Feather name={name} size={size} color={color} />
);

/**
 * Подписи вариантов — статические ключи `navigationStatic:seasonalTheme.option.*`
 * (динамических ключей в проекте нет: их не видит компайл-тайм инлайн RU).
 * `Record` по союзу заставляет typecheck дописать подпись для каждой новой темы реестра.
 */
const OPTION_COPY: Record<SeasonalThemePreference, { label: () => string; description: () => string }> = {
  auto: {
    label: () => i18nT('navigationStatic:seasonalTheme.option.auto'),
    description: () => i18nT('navigationStatic:seasonalTheme.option.auto.description'),
  },
  off: {
    label: () => i18nT('navigationStatic:seasonalTheme.option.off'),
    description: () => i18nT('navigationStatic:seasonalTheme.option.off.description'),
  },
  halloween: {
    label: () => i18nT('navigationStatic:seasonalTheme.option.halloween'),
    description: () => i18nT('navigationStatic:seasonalTheme.option.halloween.description'),
  },
  christmas: {
    label: () => i18nT('navigationStatic:seasonalTheme.option.christmas'),
    description: () => i18nT('navigationStatic:seasonalTheme.option.christmas.description'),
  },
};

const PREFERENCE_ICONS: Record<'auto' | 'off', SeasonalIconName> = {
  auto: 'calendar',
  off: 'x-circle',
};

/** Порядок: по календарю → выкл → темы реестра в порядке `SEASONAL_THEMES`. */
export const getSeasonalThemeOptions = (): SeasonalThemeOption[] => {
  const entries: Array<{ value: SeasonalThemePreference; icon: SeasonalIconName }> = [
    { value: 'auto', icon: PREFERENCE_ICONS.auto },
    { value: 'off', icon: PREFERENCE_ICONS.off },
    ...SEASONAL_THEMES.map((theme) => ({ value: theme.id, icon: theme.icon })),
  ];
  return entries.map(({ value, icon }) => ({
    value,
    label: OPTION_COPY[value].label(),
    description: OPTION_COPY[value].description(),
    renderIcon: renderIcon(icon),
  }));
};
