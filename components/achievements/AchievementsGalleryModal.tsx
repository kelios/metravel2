import { memo, useMemo, useState } from 'react';
import {
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
import type { Badge, MyAchievements } from '@/api/achievements';
import RankBar from '@/components/achievements/RankBar';
import BadgeGrid, { type BadgeGridItem } from '@/components/achievements/BadgeGrid';
import BadgeDetailSheet, {
  type BadgeDetail,
} from '@/components/achievements/BadgeDetailSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  data: MyAchievements;
}

interface CategoryGroup {
  slug: string;
  name: string;
  items: BadgeGridItem[];
}

function groupByCategory(data: MyAchievements): CategoryGroup[] {
  const order: string[] = [];
  const map = new Map<string, CategoryGroup>();

  const push = (item: BadgeGridItem) => {
    const slug = item.badge.categorySlug;
    if (!map.has(slug)) {
      order.push(slug);
      map.set(slug, { slug, name: item.badge.categoryName, items: [] });
    }
    map.get(slug)!.items.push(item);
  };

  data.earned.forEach((ub) => push({ badge: ub.badge, earned: true }));
  data.locked.forEach((p) =>
    push({ badge: p.badge, earned: false, progress: { current: p.current, threshold: p.threshold } }),
  );

  return order.map((slug) => map.get(slug)!);
}

function AchievementsGalleryModal({ visible, onClose, data }: Props) {
  const colors = useThemedColors();
  const groups = useMemo(() => groupByCategory(data), [data]);
  const [detail, setDetail] = useState<BadgeDetail | null>(null);

  const detailByBadgeId = useMemo(() => {
    const map = new Map<number, BadgeDetail>();
    data.earned.forEach((ub) =>
      map.set(ub.badge.id, { badge: ub.badge, earned: true }),
    );
    data.locked.forEach((p) =>
      map.set(p.badge.id, {
        badge: p.badge,
        earned: false,
        progress: { current: p.current, threshold: p.threshold },
      }),
    );
    return map;
  }, [data]);

  const openDetail = (badge: Badge) => {
    const found = detailByBadgeId.get(badge.id);
    if (found) setDetail(found);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
          borderTopRightRadius: DESIGN_TOKENS.radii.xl,
          maxHeight: '90%',
          paddingTop: DESIGN_TOKENS.spacing.md,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: DESIGN_TOKENS.spacing.lg,
          paddingBottom: DESIGN_TOKENS.spacing.sm,
        },
        title: {
          fontSize: DESIGN_TOKENS.typography.sizes.lg,
          fontWeight: '800',
          color: colors.text,
        },
        closeBtn: {
          width: 36,
          height: 36,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.backgroundSecondary,
        },
        body: { paddingHorizontal: DESIGN_TOKENS.spacing.lg },
        rankBlock: {
          backgroundColor: colors.surface,
          borderRadius: DESIGN_TOKENS.radii.lg,
          padding: DESIGN_TOKENS.spacing.md,
          marginBottom: DESIGN_TOKENS.spacing.lg,
          borderWidth: 1,
          borderColor: colors.borderLight,
        },
        groupTitle: {
          fontSize: DESIGN_TOKENS.typography.sizes.md,
          fontWeight: '700',
          color: colors.text,
          marginBottom: DESIGN_TOKENS.spacing.sm,
        },
        group: { marginBottom: DESIGN_TOKENS.spacing.lg },
        footerSpace: { height: DESIGN_TOKENS.spacing.xxl },
      }),
    [colors],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Достижения</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.rankBlock}>
              <RankBar rank={data.rank} />
            </View>

            {groups.map((group) => (
              <View key={group.slug} style={styles.group}>
                <Text style={styles.groupTitle}>{group.name}</Text>
                <BadgeGrid
                  items={group.items}
                  size={68}
                  onBadgePress={openDetail}
                />
              </View>
            ))}
            <View style={styles.footerSpace} />
          </ScrollView>

          <BadgeDetailSheet
            visible={detail !== null}
            onClose={() => setDetail(null)}
            detail={detail}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default memo(AchievementsGalleryModal);
