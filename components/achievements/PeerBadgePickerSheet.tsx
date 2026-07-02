import { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { usePeerBadgeCatalog, useGrantPeerBadge } from '@/hooks/useAchievementsApi';
import type { PeerBadgeReceived, PeerBadgeTarget } from '@/api/achievements';
import BadgeMedal from '@/components/achievements/BadgeMedal';

interface Props {
  visible: boolean;
  onClose: () => void;
  target: PeerBadgeTarget;
  recipientId?: string | number;
  travelId?: string | number;
  /** Текущее состояние полученных peer-наград цели (для granted/count). */
  received: PeerBadgeReceived[];
  title?: string;
}

function PeerBadgePickerSheet({
  visible,
  onClose,
  target,
  recipientId,
  travelId,
  received,
  title,
}: Props) {
  const colors = useThemedColors();
  const { data: catalog, isLoading } = usePeerBadgeCatalog();
  const grant = useGrantPeerBadge();

  const options = useMemo(
    () => (catalog ?? []).filter((b) => b.target === target),
    [catalog, target],
  );
  const stateBySlug = useMemo(
    () => new Map(received.map((r) => [r.badge.slug, r])),
    [received],
  );

  const styles = getStyles(colors);

  const heading =
    title ?? (target === 'travel' ? 'Наградить путешествие' : 'Наградить автора');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>{heading}</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primaryDark} />
            </View>
          ) : options.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="award" size={26} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Нет доступных наград</Text>
              <Text style={styles.emptyText}>
                Для этого типа контента пока нет вариантов награды.
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((badge) => {
                const st = stateBySlug.get(badge.slug);
                const granted = st?.grantedByMe ?? false;
                const count = st?.count ?? 0;
                return (
                  <Pressable
                    key={badge.id}
                    style={styles.optionRow}
                    onPress={() =>
                      grant.mutate({ badgeSlug: badge.slug, recipientId, travelId })
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: granted }}
                    accessibilityLabel={`${granted ? 'Забрать' : 'Выдать'} значок «${badge.name}»`}
                  >
                    <BadgeMedal badge={badge} size={44} earned />
                    <View style={styles.optionText}>
                      <Text style={styles.optionName} numberOfLines={1}>
                        {badge.name}
                      </Text>
                      {badge.description ? (
                        <Text style={styles.optionDesc} numberOfLines={1}>
                          {badge.description}
                        </Text>
                      ) : null}
                    </View>
                    {count > 0 ? <Text style={styles.count}>{count}</Text> : null}
                    <View style={[styles.toggle, granted && styles.toggleOn]}>
                      <Feather
                        name={granted ? 'check' : 'plus'}
                        size={16}
                        color={granted ? colors.textOnPrimary : colors.primary}
                      />
                      <Text style={[styles.toggleText, granted && styles.toggleTextOn]}>
                        {granted ? 'Выдано' : 'Выдать'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              <View style={styles.footerSpace} />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      maxHeight: '80%',
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: DESIGN_TOKENS.spacing.sm,
    },
    title: { fontSize: DESIGN_TOKENS.typography.sizes.lg, fontWeight: '800', color: colors.text },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    loading: { paddingVertical: DESIGN_TOKENS.spacing.xl, alignItems: 'center' },
    emptyState: {
      alignItems: 'center',
      paddingVertical: DESIGN_TOKENS.spacing.xl,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    emptyTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    optionText: { flex: 1, minWidth: 0 },
    optionName: { fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '700', color: colors.text },
    optionDesc: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted },
    count: { fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '800', color: colors.textMuted },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    toggleText: { fontSize: DESIGN_TOKENS.typography.sizes.xs, fontWeight: '700', color: colors.primaryText },
    toggleTextOn: { color: colors.textOnPrimary },
    footerSpace: { height: DESIGN_TOKENS.spacing.xxl },
  });

export default memo(PeerBadgePickerSheet);
