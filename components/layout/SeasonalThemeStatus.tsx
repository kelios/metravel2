import { StyleSheet, Text } from 'react-native';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatDate } from '@/i18n/format';
import type { SeasonalThemePeriod } from '@/constants/seasonalThemes';
import { getSeasonalThemeOptions } from '@/components/layout/seasonalThemeOptions';

const formatPeriod = (period: SeasonalThemePeriod): string => {
  const format = ({ year, month, day }: SeasonalThemePeriod['from']) =>
    formatDate(new Date(year, month - 1, day, 12), { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(period.from)} — ${format(period.to)}`;
};

/** Один календарный статус для меню гостя, аккаунта и настроек. */
export default function SeasonalThemeStatus() {
  const { seasonalTheme, seasonalCalendar } = useTheme();
  const colors = useThemedColors();
  const { t } = useTranslation();
  if (seasonalTheme !== 'auto' || !seasonalCalendar) return null;

  const period = seasonalCalendar.currentPeriod ?? seasonalCalendar.nextPeriod;
  const label = period ? getSeasonalThemeOptions().find(option => option.value === period.id)?.label : undefined;
  const params = period ? { value1: label, value2: formatPeriod(period) } : undefined;
  const status = seasonalCalendar.currentPeriod
    ? t('navigationStatic:seasonalTheme.status.current', params)
    : period
      ? t('navigationStatic:seasonalTheme.status.next', params)
      : t('navigationStatic:seasonalTheme.status.none');

  return (
    <Text
      testID="seasonal-theme-status"
      accessibilityLiveRegion="polite"
      style={[styles.status, { color: colors.textMuted }]}
    >
      {status}
    </Text>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: 12, lineHeight: 18, marginTop: 8, flexShrink: 1 },
});
