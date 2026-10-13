import { View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import ThemeOptionGroup from '@/components/layout/ThemeOptionGroup';
import { getSeasonalThemeOptions } from '@/components/layout/seasonalThemeOptions';
import { useTranslation } from '@/i18n/LocaleProvider';
import SeasonalThemeStatus from '@/components/layout/SeasonalThemeStatus';


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
 * тема из `constants/seasonalThemes.ts` на web, Android и iOS.
 */
export default function SeasonalThemeToggle({
  compact = false,
  layout = 'horizontal',
  showLabels = true,
}: SeasonalThemeToggleProps) {
  const { seasonalTheme, setSeasonalTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      <ThemeOptionGroup
        testID="seasonal-theme-toggle"
        options={getSeasonalThemeOptions()}
        value={seasonalTheme}
        onChange={setSeasonalTheme}
        getAccessibilityLabel={(option) => t('navigationStatic:seasonalTheme.selectLabel', { value1: option.label })}
        compact={compact}
        layout={layout}
        showLabels={showLabels}
      />
      <SeasonalThemeStatus />
    </View>
  );
}
