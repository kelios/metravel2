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

type FeedbackTravel = TravelPublicationFields & TravelModerationMetadata;

type Props = {
  travel: FeedbackTravel;
  onCorrect?: () => void;
  showStatus?: boolean;
  list?: boolean;
  /** List-wide union from `resolveListFeedbackSlots`; defaults to this card's own slots. */
  listSlots?: number;
};

const { spacing, typography, touchTarget } = DESIGN_TOKENS;
const FEEDBACK_LINE_HEIGHT = typography.scale.bodySmall.lineHeight;
const REASON_LINE_HEIGHT = typography.sizes.sm * 1.5;
const DATE_LINE_HEIGHT = typography.scale.caption.lineHeight;
const CORRECTION_LINE_HEIGHT = typography.scale.body.lineHeight;
// Optional rows below the status chip. A list reserves one common floor for the
// slots present in ANY of its cards (#2669: rows stay level across independent
// flex rows), but never for slots no card has — a drafts-only list must not get
// the rejected-card footer as dead space (#2815). Button sm has spacing.xs
// vertical padding and outline has two 2px borders. A minimum rather than a
// fixed height keeps larger accessibility text free to grow rather than clip.
const SLOT_REASON = 1;
const SLOT_DATE = 2;
const SLOT_CORRECTION = 4;
const SLOT_HEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [SLOT_REASON, FEEDBACK_LINE_HEIGHT + 2 * REASON_LINE_HEIGHT + touchTarget.minHeight],
  [SLOT_DATE, 2 * DATE_LINE_HEIGHT],
  [SLOT_CORRECTION, Math.max(touchTarget.minHeight, 2 * CORRECTION_LINE_HEIGHT + 2 * spacing.xs + 4)],
];

function resolveFeedbackSlots(travel: FeedbackTravel): number {
  const feedback = resolveTravelModerationFeedback(travel);
  return (feedback.reason ? SLOT_REASON : 0)
    | (feedback.decidedAt ? SLOT_DATE : 0)
    | (feedback.status === 'rejected' ? SLOT_CORRECTION : 0);
}

export function resolveListFeedbackSlots(travels: readonly FeedbackTravel[]): number {
  return travels.reduce((slots, travel) => slots | resolveFeedbackSlots(travel), 0);
}

// Author lists show the status as an icon on the card, so their footer holds
// only the optional rows and collapses entirely when no card in the list has one.
const listFeedbackMinHeight = (slots: number, withStatus: boolean) => {
  const rows = SLOT_HEIGHTS.filter(([slot]) => slots & slot).map(([, height]) => height);
  if (withStatus) rows.unshift(FEEDBACK_LINE_HEIGHT + 2 * spacing.xs);
  return rows.length ? 2 * spacing.md + rows.reduce((sum, height) => sum + height, 0) + (rows.length - 1) * spacing.sm : 0;
};

const listRootStyle = (minHeight: number) => ({ padding: minHeight ? spacing.md : 0, flexGrow: 1, minHeight });

export default function TravelModerationFeedback({ travel, onCorrect, showStatus = true, list = false, listSlots }: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const feedback = resolveTravelModerationFeedback(travel);
  const [openedReason, setOpenedReason] = useState<string | null>(null);
  useEffect(() => setOpenedReason(null), [feedback.status, feedback.reason]);
  const slots = listSlots ?? (list ? resolveFeedbackSlots(travel) : 0);
  const styles = useMemo(() => StyleSheet.create({
    root: { gap: spacing.sm, minWidth: 0, ...(list ? listRootStyle(listFeedbackMinHeight(slots, showStatus)) : {}) },
    reason: { color: colors.text, fontSize: typography.sizes.sm, lineHeight: REASON_LINE_HEIGHT, ...(list ? { minHeight: 2 * REASON_LINE_HEIGHT } : {}) },
    reasonLabel: { color: colors.text, fontWeight: '600', fontSize: typography.sizes.sm, lineHeight: FEEDBACK_LINE_HEIGHT },
    date: { color: colors.textMuted, fontSize: typography.sizes.xs, lineHeight: DATE_LINE_HEIGHT },
    details: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: touchTarget.minHeight },
    detailsText: { color: colors.primaryText, fontSize: typography.sizes.sm, fontWeight: '600', lineHeight: FEEDBACK_LINE_HEIGHT },
    correctionLabel: { lineHeight: CORRECTION_LINE_HEIGHT },
  }), [colors, list, showStatus, slots]);
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
