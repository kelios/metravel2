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
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: isMobile ? 16 : 20,
      paddingHorizontal: isMobile ? 16 : 20,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        },
      }),
    },
    iconWrap: {
      width: isMobile ? 44 : 52,
      height: isMobile ? 44 : 52,
      borderRadius: 14,
      backgroundColor: colors.primaryLight,
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
      gap: 4,
      paddingTop: 2,
    },
    title: {
      fontSize: isMobile ? 15 : 16,
      fontWeight: '700',
      color: colors.text,
      lineHeight: isMobile ? 20 : 22,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 19,
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
