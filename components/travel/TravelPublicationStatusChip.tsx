import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { TranslationKey } from '@/i18n';
import type { TravelDisplayStatus } from '@/utils/travelPublicationStatus';

const STATUS_LABELS = {
  draft: 'travel:components.travel.TravelWizardStepPublish.chernovik_80f263f2',
  pending_review: 'travel:components.travel.TravelWizardStepPublish.otpravleno_na_moderatsiyu_6f9b87dd',
  approved: 'travel:components.travel.TravelWizardStepPublish.approved',
  published: 'travel:components.travel.TravelWizardStepPublish.opublikovano_572457aa',
  rejected: 'travel:moderationFeedback.rejected',
} satisfies Record<NonNullable<TravelDisplayStatus>, TranslationKey>;

export default function TravelPublicationStatusChip({ status, compact = false, testID }: {
  status: TravelDisplayStatus;
  compact?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => StyleSheet.create({
    chip: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs,
      maxWidth: '100%', paddingVertical: compact ? 2 : DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: compact ? 6 : DESIGN_TOKENS.spacing.sm, borderRadius: DESIGN_TOKENS.radii.pill,
    },
    label: { fontSize: compact ? 11 : DESIGN_TOKENS.typography.sizes.sm, fontWeight: '700', flexShrink: 1 },
  }), [compact]);
  const tone = status === 'rejected' ? colors.dangerDark
    : status === 'published' || status === 'approved' ? colors.successDark
      : status === 'pending_review' || compact ? colors.warningDark : colors.text;
  const backgroundColor = status === 'rejected' ? colors.dangerSoft
    : status === 'published' || status === 'approved' ? colors.successSoft
      : status === 'pending_review' || compact ? colors.warningSoft : colors.backgroundSecondary;
  return (
    <View style={[styles.chip, { backgroundColor }]} testID={testID}>
      {compact ? <Feather name="edit-3" size={11} color={tone} /> : null}
      <Text style={[styles.label, { color: tone }]}>
        {t(status ? STATUS_LABELS[status] : 'errorsStatic:api.misc.unsupportedPublicationStatus')}
      </Text>
    </View>
  );
}
