import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import CardActionPressable from '@/components/ui/CardActionPressable';
import InfoSheet from '@/components/ui/InfoSheet';
import TravelPublicationStatusChip from '@/components/travel/TravelPublicationStatusChip';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { formatDateTime } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';
import { resolveTravelModerationFeedback, type TravelPublicationFields } from '@/utils/travelPublicationStatus';
import type { TravelModerationMetadata } from '@/types/types';

type Props = {
  travel: TravelPublicationFields & TravelModerationMetadata;
  onCorrect?: () => void;
  showStatus?: boolean;
  list?: boolean;
};

export default function TravelModerationFeedback({ travel, onCorrect, showStatus = true, list = false }: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const feedback = resolveTravelModerationFeedback(travel);
  const [openedReason, setOpenedReason] = useState<string | null>(null);
  useEffect(() => setOpenedReason(null), [feedback.status, feedback.reason]);
  const styles = useMemo(() => StyleSheet.create({
    root: { gap: DESIGN_TOKENS.spacing.sm, minWidth: 0, ...(list ? { padding: DESIGN_TOKENS.spacing.md, flexGrow: 1 } : {}) },
    reason: { color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.sm, lineHeight: 21 },
    reasonLabel: { color: colors.text, fontWeight: '600', fontSize: DESIGN_TOKENS.typography.sizes.sm },
    date: { color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.xs },
    details: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: DESIGN_TOKENS.touchTarget.minHeight },
    detailsText: { color: colors.primaryText, fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '600' },
  }), [colors, list]);
  const showFullReason = Boolean(feedback.reason && openedReason === feedback.reason);

  return (
    <View style={styles.root} testID="travel-moderation-feedback">
      {showStatus ? <TravelPublicationStatusChip status={feedback.status} /> : null}
      {feedback.reason ? (
        <View>
          <Text style={styles.reasonLabel}>{t('travel:moderationFeedback.reason')}</Text>
          <Text style={styles.reason} numberOfLines={2} testID="moderation-reason-preview">{feedback.reason}</Text>
          <CardActionPressable
            onPress={() => setOpenedReason(feedback.reason)}
            accessibilityLabel={t('travel:moderationFeedback.fullReason')}
            accessibilityState={{ expanded: showFullReason }}
            style={styles.details}
            testID="moderation-reason-expand"
          >
            <Text style={styles.detailsText}>{t('travel:moderationFeedback.more')}</Text>
          </CardActionPressable>
        </View>
      ) : null}
      {feedback.decidedAt ? (
        <Text style={styles.date} testID="moderation-decision-date">
          {t('travel:moderationFeedback.decidedAt', { date: formatDateTime(feedback.decidedAt) })}
        </Text>
      ) : null}
      {feedback.status === 'rejected' && onCorrect ? (
        <Button label={t('travel:moderationFeedback.correctAndResubmit')} onPress={onCorrect}
          variant="outline" fullWidth labelNumberOfLines={2} testID="moderation-correct-button" />
      ) : null}
      <InfoSheet visible={showFullReason} onClose={() => setOpenedReason(null)}
        title={t('travel:moderationFeedback.reason')} paragraphs={feedback.reason ? [feedback.reason] : []} />
    </View>
  );
}
