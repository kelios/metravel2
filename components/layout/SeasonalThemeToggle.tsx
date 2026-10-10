import { Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import ThemeOptionGroup from '@/components/layout/ThemeOptionGroup';
import { getSeasonalThemeOptions } from '@/components/layout/seasonalThemeOptions';
import { translate as i18nT } from '@/i18n'


interface SeasonalThemeToggleProps {
  /** Компактный режим без рамки */
  compact?: boolean;
  /** Вертикальное расположение кнопок */
  layout?: 'horizontal' | 'vertical';
  /** Показывать подписи */
  showLabels?: boolean;
}

/**
 * Переключатель праздничного оформления (#2376): по календарю / выкл / каждая
 * тема из `constants/seasonalThemes.ts`. Только web: на Android/iOS токены —
 * литералы StyleSheet, сезонной палитры там нет, и обещать её контролом нельзя.
 */
export default function SeasonalThemeToggle({
  compact = false,
  layout = 'horizontal',
  showLabels = true,
}: SeasonalThemeToggleProps) {
  const { seasonalTheme, setSeasonalTheme } = useTheme();

  if (Platform.OS !== 'web') return null;

  return (
    <ThemeOptionGroup
      testID="seasonal-theme-toggle"
      options={getSeasonalThemeOptions()}
      value={seasonalTheme}
      onChange={setSeasonalTheme}
      getAccessibilityLabel={(option) => i18nT('navigationStatic:seasonalTheme.selectLabel', { value1: option.label })}
      compact={compact}
      layout={layout}
      showLabels={showLabels}
    />
  );
}
