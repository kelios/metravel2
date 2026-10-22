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

const { spacing, typography, touchTarget } = DESIGN_TOKENS;
const FEEDBACK_LINE_HEIGHT = typography.scale.bodySmall.lineHeight;
const REASON_LINE_HEIGHT = typography.sizes.sm * 1.5;
const DATE_LINE_HEIGHT = typography.scale.caption.lineHeight;
const CORRECTION_LINE_HEIGHT = typography.scale.body.lineHeight;
// One collapsed author-list floor, independent of the current decision/row.
// Button sm has spacing.xs vertical padding and outline has two 2px borders.
// Reserve two date/action lines as well as the bounded reason preview; use a
// minimum, so larger accessibility text remains free to grow rather than clip.
const LIST_FEEDBACK_MIN_HEIGHT = 2 * spacing.md
  + FEEDBACK_LINE_HEIGHT + 2 * spacing.xs
  + FEEDBACK_LINE_HEIGHT + 2 * REASON_LINE_HEIGHT + touchTarget.minHeight
  + 2 * DATE_LINE_HEIGHT
  + Math.max(touchTarget.minHeight, 2 * CORRECTION_LINE_HEIGHT + 2 * spacing.xs + 4)
  + 3 * spacing.sm;

export default function TravelModerationFeedback({ travel, onCorrect, showStatus = true, list = false }: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const feedback = resolveTravelModerationFeedback(travel);
  const [openedReason, setOpenedReason] = useState<string | null>(null);
  useEffect(() => setOpenedReason(null), [feedback.status, feedback.reason]);
  const styles = useMemo(() => StyleSheet.create({
    root: { gap: spacing.sm, minWidth: 0, ...(list ? { padding: spacing.md, flexGrow: 1, minHeight: LIST_FEEDBACK_MIN_HEIGHT } : {}) },
    reason: { color: colors.text, fontSize: typography.sizes.sm, lineHeight: REASON_LINE_HEIGHT, ...(list ? { minHeight: 2 * REASON_LINE_HEIGHT } : {}) },
    reasonLabel: { color: colors.text, fontWeight: '600', fontSize: typography.sizes.sm, lineHeight: FEEDBACK_LINE_HEIGHT },
    date: { color: colors.textMuted, fontSize: typography.sizes.xs, lineHeight: DATE_LINE_HEIGHT },
    details: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: touchTarget.minHeight },
    detailsText: { color: colors.primaryText, fontSize: typography.sizes.sm, fontWeight: '600', lineHeight: FEEDBACK_LINE_HEIGHT },
    correctionLabel: { lineHeight: CORRECTION_LINE_HEIGHT },
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
          variant="outline" size={list ? 'sm' : 'md'} fullWidth labelNumberOfLines={2}
          labelStyle={list ? styles.correctionLabel : undefined} testID="moderation-correct-button" />
      ) : null}
      <InfoSheet visible={showFullReason} onClose={() => setOpenedReason(null)}
        title={t('travel:moderationFeedback.reason')} paragraphs={feedback.reason ? [feedback.reason] : []} />
    </View>
  );
}
