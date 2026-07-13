import { memo, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus';
import type { Travel } from '@/types/types';

type Props = {
  drafts: Travel[];
  onOpenDraft: (travelId: number) => void;
  onCreateTravel: () => void;
  maxVisible?: number;
};

const formatDraftDate = (value: string | undefined) => {
  if (!value) return 'сохранён недавно';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'сохранён недавно';

  return `обновлён ${date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })}`;
};

function ProfileDraftResumePanel({
  drafts,
  onOpenDraft,
  onCreateTravel,
  maxVisible = 3,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const visibleDrafts = useMemo(
    () =>
      drafts
        .slice()
        .sort((left, right) => {
          const leftTime = new Date(left.updated_at ?? left.created_at ?? 0).getTime();
          const rightTime = new Date(right.updated_at ?? right.created_at ?? 0).getTime();
          return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
        })
        .slice(0, maxVisible),
    [drafts, maxVisible],
  );
  const hiddenCount = Math.max(0, drafts.length - visibleDrafts.length);

  if (drafts.length === 0) return null;

  return (
    <View style={styles.card} testID="profile-draft-resume-panel">
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Feather name="edit-3" size={17} color={colors.warning} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Черновики маршрутов</Text>
          <Text style={styles.subtitle}>
            Продолжите сохранённый маршрут или начните новый.
          </Text>
        </View>
      </View>

      <View style={styles.draftList}>
        {visibleDrafts.map((draft) => {
          const title = draft.name?.trim() || 'Без названия';
          const dateLabel = formatDraftDate(draft.updated_at ?? draft.created_at);

          return (
            <Pressable
              key={String(draft.id)}
              onPress={() => onOpenDraft(draft.id)}
              accessibilityRole="button"
              accessibilityLabel={`Открыть черновик ${title}`}
              accessibilityHint="Открыть редактор маршрута и продолжить заполнение"
              style={({ pressed }) => [
                styles.draftRow,
                globalFocusStyles.focusable,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.draftText}>
                <Text style={styles.draftTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.draftMeta} numberOfLines={1}>
                  {dateLabel}
                </Text>
              </View>
              <View style={styles.openButton}>
                <Feather name="arrow-right" size={16} color={colors.primaryDark} />
                <Text style={styles.openButtonText}>Открыть</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footerRow}>
        {hiddenCount > 0 ? (
          <Text style={styles.moreText}>
            Ещё {hiddenCount} в списке ниже
          </Text>
        ) : (
          <Text style={styles.moreText}>Черновики также видны в списке маршрутов</Text>
        )}
        <Pressable
          onPress={onCreateTravel}
          accessibilityRole="button"
          accessibilityLabel="Создать новый маршрут"
          style={({ pressed }) => [
            styles.newButton,
            globalFocusStyles.focusable,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="plus" size={15} color={colors.textOnPrimary} />
          <Text style={styles.newButtonText}>Новый</Text>
        </Pressable>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    card: {
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: DESIGN_TOKENS.spacing.sm,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.card,
        } as any,
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: DESIGN_TOKENS.spacing.sm,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.warningSoft,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      lineHeight: 21,
      fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 19,
      color: colors.textMuted,
    },
    draftList: {
      gap: DESIGN_TOKENS.spacing.xs,
    },
    draftRow: {
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xs,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        web: { cursor: 'pointer' } as any,
        default: {},
      }),
    },
    pressed: {
      opacity: 0.72,
    },
    draftText: {
      flex: 1,
      minWidth: 0,
    },
    draftTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 18,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.text,
    },
    draftMeta: {
      marginTop: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 16,
      color: colors.textMuted,
    },
    openButton: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    openButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 18,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.primaryText,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: DESIGN_TOKENS.spacing.sm,
      flexWrap: 'wrap',
    },
    moreText: {
      flex: 1,
      minWidth: 180,
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      lineHeight: 16,
      color: colors.textMuted,
    },
    newButton: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.brand,
      ...Platform.select({
        web: { cursor: 'pointer' } as any,
        default: {},
      }),
    },
    newButtonText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      lineHeight: 18,
      fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
      color: colors.textOnPrimary,
    },
  });

export default memo(ProfileDraftResumePanel);
