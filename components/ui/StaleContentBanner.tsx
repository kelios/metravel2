import Feather from '@expo/vector-icons/Feather';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import type { PublicStalePayloadMeta } from '@/utils/publicStaleCache';
import { translate as i18nT } from '@/i18n'
import { formatDateTime } from '@/i18n/format'


type StaleContentBannerProps = {
  meta: PublicStalePayloadMeta | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const formatSavedAt = (value: string): string | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return formatDateTime(date, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    dateStyle: undefined,
    timeStyle: undefined,
  });
};

export default function StaleContentBanner({
  meta,
  style,
  testID = 'stale-content-banner',
}: StaleContentBannerProps) {
  const colors = useThemedColors();
  const savedAtLabel = useMemo(() => (meta ? formatSavedAt(meta.savedAt) : null), [meta]);

  if (!meta) return null;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.warningSoft,
          borderColor: colors.warningAlpha40,
        },
        style,
      ]}
      testID={testID}
    >
      <Feather name="wifi-off" size={18} color={colors.warning} />
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]}>{i18nT('shared:components.ui.StaleContentBanner.pokazyvaem_sohranennye_dannye_8f209579')}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>
          {savedAtLabel
            ? i18nT('shared:components.ui.StaleContentBanner.ne_udalos_obnovit_dannye_versiya_sohranena_v_95ebff3c', { value1: savedAtLabel })
            : i18nT('shared:components.ui.StaleContentBanner.ne_udalos_obnovit_dannye_pokazana_poslednyay_e933e9d4')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'flex-start',
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  textColumn: {
    flex: 1,
    gap: DESIGN_TOKENS.spacing.xxs,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
  },
  description: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 18,
  },
});
