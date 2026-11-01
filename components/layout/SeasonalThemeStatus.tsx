import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useTheme, useThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { formatDate } from '@/i18n/format';
import type { SeasonalThemePeriod } from '@/constants/seasonalThemes';
import { ADVENT_ROUTE, isAdventCampaignWindow } from '@/constants/advent';
import { getSeasonalThemeOptions } from '@/components/layout/seasonalThemeOptions';

const formatPeriod = (period: SeasonalThemePeriod): string => {
  const format = ({ year, month, day }: SeasonalThemePeriod['from']) =>
    formatDate(new Date(year, month - 1, day, 12), { day: 'numeric', month: 'short', year: 'numeric' });
  return `${format(period.from)} — ${format(period.to)}`;
};

type Props = {
  /**
   * Ссылка «Открыть дверцу дня» в окне адвента (#2866). Включается только там, где
   * навигация не живёт в Modal меню (настройки): пункт `/advent` в меню аккаунта и
   * листе «Ещё» идёт через `SUPPLEMENTARY_NAV_ITEMS` и закрывает меню штатно.
   */
  showAdventLink?: boolean;
};

/**
 * Один календарный статус для меню гостя, аккаунта и настроек. Ссылка на дверцу
 * дня не зависит от выбранного оформления: кампания идёт и при выключенной теме.
 */
export default function SeasonalThemeStatus({ showAdventLink = false }: Props) {
  const { seasonalTheme, seasonalCalendar } = useTheme();
  const colors = useThemedColors();
  const { t } = useTranslation();
  const showStatus = seasonalTheme === 'auto' && !!seasonalCalendar;
  const showAdvent = showAdventLink && isAdventCampaignWindow();
  if (!showStatus && !showAdvent) return null;

  let status: string | null = null;
  if (showStatus && seasonalCalendar) {
    const period = seasonalCalendar.currentPeriod ?? seasonalCalendar.nextPeriod;
    const label = period ? getSeasonalThemeOptions().find(option => option.value === period.id)?.label : undefined;
    const params = period ? { value1: label, value2: formatPeriod(period) } : undefined;
    status = seasonalCalendar.currentPeriod
      ? t('navigationStatic:seasonalTheme.status.current', params)
      : period
        ? t('navigationStatic:seasonalTheme.status.next', params)
        : t('navigationStatic:seasonalTheme.status.none');
  }

  return (
    <View style={styles.wrap}>
      {status ? (
        <Text
          testID="seasonal-theme-status"
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: colors.textMuted }]}
        >
          {status}
        </Text>
      ) : null}
      {showAdvent ? (
        <Link href={ADVENT_ROUTE as never} asChild>
          <Text testID="seasonal-theme-advent-link" accessibilityRole="link" style={[styles.link, { color: colors.primaryDark }]}>
            {t('adventStatic:status.link')}
          </Text>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 4, flexShrink: 1 },
  status: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  // 44dp тач-таргет ссылки — высотой строки, а не hitSlop (guard-touch-targets).
  link: { fontSize: 13, lineHeight: 20, fontWeight: '600', minHeight: 44, paddingVertical: 12, flexShrink: 1 },
});
