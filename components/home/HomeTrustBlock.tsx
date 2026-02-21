import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

type TrustItem = {
  icon: string;
  title: string;
  subtitle: string;
};

const ITEMS: TrustItem[] = [
  {
    icon: 'navigation',
    title: 'Готовые маршруты под вас',
    subtitle: 'Фильтруй по расстоянию, формату и длительности — без долгой подготовки',
  },
  {
    icon: 'bookmark',
    title: 'Личная книга поездок',
    subtitle: 'Сохраняй маршруты с фото и заметками — всё в одном месте',
  },
  {
    icon: 'share-2',
    title: 'PDF или ссылка за минуту',
    subtitle: 'Скачай готовую книгу или отправь ссылку — делиться просто',
  },
];

function HomeTrustBlock() {
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone || isLargePhone;
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    band: {
      width: '100%',
      alignSelf: 'stretch',
      paddingVertical: isMobile ? 28 : 40,
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({
        web: {
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.borderLight,
        },
      }),
    },
    sectionHeader: {
      marginBottom: isMobile ? 20 : 28,
      gap: 8,
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    sectionTitle: {
      fontSize: isMobile ? 22 : 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
      lineHeight: isMobile ? 28 : 36,
    },
    sectionSubtitle: {
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 20 : 22,
      color: colors.textMuted,
      maxWidth: 560,
    },
    items: {
      width: '100%',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 16,
    },
    item: {
      flex: isMobile ? undefined : 1,
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: isMobile ? 20 : 24,
      paddingHorizontal: isMobile ? 20 : 24,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
      }),
    },
    iconWrap: {
      width: isMobile ? 48 : 56,
      height: isMobile ? 48 : 56,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(135deg, ${colors.primarySoft} 0%, ${colors.primaryLight} 100%)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        },
      }),
    },
    textWrap: {
      flex: 1,
      gap: 6,
      paddingTop: 4,
    },
    title: {
      fontSize: isMobile ? 16 : 18,
      fontWeight: '800',
      color: colors.text,
      lineHeight: isMobile ? 22 : 24,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.band} testID="home-trust-block">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.sectionHeader}>
          <View style={styles.eyebrow}>
            <Feather name="book-open" size={11} color={colors.primary} />
            <Text style={styles.eyebrowText}>Почему это удобно</Text>
          </View>
          <Text style={styles.sectionTitle}>Всё для поездок — в одном месте</Text>
          <Text style={styles.sectionSubtitle}>
            Маршруты, идеи и воспоминания — собери их в личную книгу и делись с теми, кому важно.
          </Text>
        </View>
        <View style={styles.items}>
          {ITEMS.map((item) => (
            <View key={item.title} style={styles.item}>
              <View style={styles.iconWrap}>
                <Feather name={item.icon as any} size={isMobile ? 20 : 22} color={colors.primary} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeTrustBlock);
