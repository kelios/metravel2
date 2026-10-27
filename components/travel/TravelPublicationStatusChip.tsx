import React, { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import ActionTooltip from '@/components/ui/ActionTooltip';
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

export const travelDisplayStatusLabelKey = (status: TravelDisplayStatus): TranslationKey =>
  status ? STATUS_LABELS[status] : 'errorsStatic:api.misc.unsupportedPublicationStatus';

const STATUS_ICONS = {
  draft: 'edit-3',
  pending_review: 'clock',
  approved: 'thumbs-up',
  published: 'check-circle',
  rejected: 'x-circle',
} satisfies Record<NonNullable<TravelDisplayStatus>, React.ComponentProps<typeof Feather>['name']>;

const ICON_BADGE_SIZE = 22;

export default function TravelPublicationStatusChip({ status, compact = false, iconOnly = false, testID }: {
  status: TravelDisplayStatus;
  compact?: boolean;
  /** Card meta row: the status reads from icon and tone; the label goes to a11y and the web tooltip. */
  iconOnly?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const anchorRef = useRef<ViewInstance | null>(null);
  const [hovered, setHovered] = useState(false);
  const styles = useMemo(() => StyleSheet.create({
    chip: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs,
      maxWidth: '100%', paddingVertical: compact ? 2 : DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: compact ? 6 : DESIGN_TOKENS.spacing.sm, borderRadius: DESIGN_TOKENS.radii.pill,
    },
    label: {
      fontSize: compact ? 11 : DESIGN_TOKENS.typography.sizes.sm,
      ...(compact ? {} : { lineHeight: DESIGN_TOKENS.typography.scale.bodySmall.lineHeight }),
      fontWeight: '700', flexShrink: 1,
    },
    iconBadge: {
      width: ICON_BADGE_SIZE, height: ICON_BADGE_SIZE, borderRadius: DESIGN_TOKENS.radii.pill,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
  }), [compact]);
  const tone = status === 'rejected' ? colors.dangerDark
    : status === 'published' || status === 'approved' ? colors.successDark
      : status === 'pending_review' || compact ? colors.warningDark : colors.text;
  const backgroundColor = status === 'rejected' ? colors.dangerSoft
    : status === 'published' || status === 'approved' ? colors.successSoft
      : status === 'pending_review' || compact ? colors.warningSoft : colors.backgroundSecondary;
  const label = t(travelDisplayStatusLabelKey(status));
  if (iconOnly) {
    return (
      <View ref={anchorRef} style={[styles.iconBadge, { backgroundColor }]} testID={testID}
        accessible accessibilityRole="image" accessibilityLabel={label}
        {...(Platform.OS === 'web' ? {
          // A touch also fires pointerenter; only a mouse hover may open the hint.
          onPointerEnter: (event: { nativeEvent: { pointerType?: string } }) => setHovered(event.nativeEvent.pointerType === 'mouse'),
          onPointerLeave: () => setHovered(false),
        } : null)}>
        <Feather name={status ? STATUS_ICONS[status] : 'help-circle'} size={13} color={tone} />
        {Platform.OS === 'web' ? (
          <ActionTooltip anchorRef={anchorRef} label={label} visible={hovered} onDismiss={() => setHovered(false)} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={[styles.chip, { backgroundColor }]} testID={testID}>
      {compact ? <Feather name="edit-3" size={11} color={tone} /> : null}
      <Text style={[styles.label, { color: tone }]}>{label}</Text>
    </View>
  );
}
