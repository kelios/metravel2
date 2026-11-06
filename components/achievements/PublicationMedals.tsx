import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { UserBadge } from '@/api/achievements';
import BadgeDetailSheet from '@/components/achievements/BadgeDetailSheet';
import BadgeMedal from '@/components/achievements/BadgeMedal';
import Button from '@/components/ui/Button';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useTranslation } from '@/i18n/LocaleProvider';

const PUBLICATION_MEDAL_SLUGS = ['first-travel', 'belarus-map-contributor'] as const;

export default function PublicationMedals({ earned }: { earned?: readonly UserBadge[] }) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const medals = PUBLICATION_MEDAL_SLUGS
    .map((slug) => earned?.find((item) => item.badge.slug === slug))
    .filter((item) => item !== undefined);
  if (medals.length === 0) return null;

  const selected = medals.find((item) => item.id === selectedId);

  return (
    <View style={styles.row}>
      {medals.map(({ id, badge }) => (
        <Button
          key={badge.slug}
          size="sm"
          variant="tonal"
          style={styles.medal}
          labelStyle={styles.label}
          label={badge.slug === 'first-travel' ? t('achievements:contributionIdentity.authorShort') : badge.name}
          accessibilityLabel={t('achievements:contributionIdentity.detailsLabel', { name: badge.name })}
          icon={
            <View aria-hidden>
              <BadgeMedal badge={badge} size={28} />
            </View>
          }
          onPress={() => setSelectedId(id)}
        />
      ))}
      {selected ? (
        <BadgeDetailSheet
          visible
          onClose={() => setSelectedId(null)}
          detail={{ badge: selected.badge, earned: true, earnedAt: selected.earnedAt }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    maxWidth: '100%',
    gap: DESIGN_TOKENS.spacing.xxs,
  },
  medal: {
    maxWidth: '100%',
    minWidth: DESIGN_TOKENS.touchTarget.minWidth,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
  },
});
