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

function HomeTrustBlock() {
  const { isSmallPhone, isPhone, isLargePhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone || isLargePhone;
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема

  const styles = useMemo(() => StyleSheet.create({
    band: {
      width: '100%',
      alignSelf: 'stretch',
      paddingVertical: 0,
      backgroundColor: colors.background,
    },
    card: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 20,
      paddingHorizontal: 24,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
          backdropFilter: 'blur(8px)',
        },
      }),
    },
    items: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 0,
    },
    itemsMobile: {
      flexDirection: 'column',
      flexWrap: 'nowrap',
      gap: 16,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 240,
      paddingVertical: 4,
      paddingHorizontal: 12,
      ...Platform.select({
        web: {
          borderRightWidth: 1,
          borderRightColor: colors.borderLight,
        },
      }),
    },
    itemLast: {
      ...Platform.select({
        web: {
          borderRightWidth: 0,
        },
      }),
    },
    itemMobile: {
      flexGrow: 0,
      flexBasis: 'auto',
      minWidth: 0,
      width: '100%',
      paddingHorizontal: 0,
      ...Platform.select({
        web: {
          borderRightWidth: 0,
          borderTopWidth: 0,
        },
      }),
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
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
      minWidth: 0,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
      lineHeight: 18,
      letterSpacing: -0.1,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
  }), [colors]);

  return (
    <View style={styles.band} testID="home-trust-block">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.card}>
          <View style={[styles.items, isMobile && styles.itemsMobile]}>
            {ITEMS.map((item, idx) => (
              <View key={item.title} style={[styles.item, isMobile && styles.itemMobile, idx === ITEMS.length - 1 && styles.itemLast]}>
                <View style={styles.iconWrap}>
                  <Feather name={item.icon as any} size={20} color={colors.primary} />
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

export default memo(HomeTrustBlock);
