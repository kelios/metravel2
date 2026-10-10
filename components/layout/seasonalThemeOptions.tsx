import type { ReactNode } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SEASONAL_THEMES, type SeasonalThemePreference } from '@/constants/seasonalThemes';
import { translate as i18nT } from '@/i18n'


export interface SeasonalThemeOption {
  value: SeasonalThemePreference;
  label: string;
  description: string;
  renderIcon: (size: number, color: string) => ReactNode;
}

const renderMci = (name: string) => (size: number, color: string) => (
  <MaterialCommunityIcons name={name as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={size} color={color} />
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

const PREFERENCE_ICONS: Record<'auto' | 'off', string> = {
  auto: 'calendar-month-outline',
  off: 'close-circle-outline',
};

/** Порядок: по календарю → выкл → темы реестра в порядке `SEASONAL_THEMES`. */
export const getSeasonalThemeOptions = (): SeasonalThemeOption[] => {
  const entries: Array<{ value: SeasonalThemePreference; icon: string }> = [
    { value: 'auto', icon: PREFERENCE_ICONS.auto },
    { value: 'off', icon: PREFERENCE_ICONS.off },
    ...SEASONAL_THEMES.map((theme) => ({ value: theme.id, icon: theme.icon })),
  ];
  return entries.map(({ value, icon }) => ({
    value,
    label: OPTION_COPY[value].label(),
    description: OPTION_COPY[value].description(),
    renderIcon: renderMci(icon),
  }));
};
