import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';
import { useResponsive } from '@/hooks/useResponsive';

type TrustItem = {
  icon: string;
  title: string;
  subtitle: string;
};

const ITEMS: TrustItem[] = [
  {
    icon: 'file-text',
    title: 'Экспорт в PDF',
    subtitle: 'Собери книгу из своих историй',
  },
  {
    icon: 'lock',
    title: 'Приватно',
    subtitle: 'Публикуй только то, чем хочешь делиться',
  },
  {
    icon: 'printer',
    title: 'Печать',
    subtitle: 'Красивый макет для печатной версии',
  },
];

export default function HomeTrustBlock() {
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone || isLargePhone;

  return (
    <View style={styles.band} testID="home-trust-block">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.card}>
          <View style={[styles.items, isMobile && styles.itemsMobile]}>
            {ITEMS.map((item) => (
              <View key={item.title} style={[styles.item, isMobile && styles.itemMobile]}>
                <View style={styles.iconWrap}>
                  <Feather name={item.icon as any} size={18} color={DESIGN_TOKENS.colors.primary} />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 20,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
  card: {
    width: '100%',
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 22px rgba(31, 31, 31, 0.06)',
      },
    }),
  },
  items: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    ...Platform.select({
      web: {
        rowGap: 16,
        columnGap: 16,
      },
    }),
  },
  itemsMobile: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 240,
    paddingVertical: 6,
  },
  itemMobile: {
    flexGrow: 0,
    flexBasis: 'auto',
    minWidth: 0,
    width: '100%',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: DESIGN_TOKENS.colors.textMuted,
  },
});
