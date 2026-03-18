import React, { useMemo, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, LayoutAnimation, UIManager } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';

type FaqItem = {
  q: string;
  a: string;
};

function HomeFAQSection() {
  const colors = useThemedColors();

  const items = useMemo<FaqItem[]>(
    () => [
      {
        q: 'Это бесплатно?',
        a: 'Да, полностью бесплатно. Смотреть маршруты можно без регистрации. Регистрация нужна только чтобы сохранять поездки и собирать книгу.',
      },
      {
        q: 'Нужна регистрация, чтобы смотреть маршруты?',
        a: 'Нет. Маршруты открыты для всех. Регистрация нужна только если хочешь сохранять поездки и собирать свою книгу.',
      },
      {
        q: 'Как собрать книгу из поездок?',
        a: 'Открой раздел «Экспорт», выбери нужные поездки и стиль — и скачай готовый PDF. Занимает пару минут.',
      },
      {
        q: 'Поездки видны только мне?',
        a: 'Да. Всё, что ты сохраняешь, остаётся личным — ты сам решаешь, чем делиться, а что оставить для себя.',
      },
      {
        q: 'PDF можно распечатать?',
        a: 'Да, книга формируется в печатном формате. Можно сохранить файл или отправить в типографию.',
      },
    ],
    []
  );

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = useCallback((idx: number) => {
    // На native включаем плавную LayoutAnimation
    if (Platform.OS !== 'web') {
      // Android требует явного включения LayoutAnimation
      if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  const { isSmallPhone, isPhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone;

  const styles = useMemo(() => StyleSheet.create({
    band: {
      width: '100%',
      alignSelf: 'stretch',
      paddingTop: isMobile ? 36 : 64,
      paddingBottom: isMobile ? 32 : 56,
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({
        web: {
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.borderLight,
          backgroundImage: `linear-gradient(180deg, ${colors.background} 0%, ${colors.backgroundSecondary} 30%)`,
        },
      }),
    },
    inner: {
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
    },
    header: {
      alignItems: 'center',
      marginBottom: isMobile ? 24 : 40,
      gap: 10,
    },
    eyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      paddingHorizontal: 14,
      paddingVertical: 6,
      ...Platform.select({
        web: { boxShadow: `0 1px 6px ${colors.primary}14` },
      }),
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isMobile ? 24 : 38,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: isMobile ? -0.6 : -1.0,
      textAlign: 'center',
      lineHeight: isMobile ? 30 : 48,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 21 : 25,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 440,
      letterSpacing: 0.1,
    },
    list: {
      gap: isMobile ? 8 : 10,
    },
    item: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          transition: 'border-color 0.22s ease, box-shadow 0.22s ease',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        },
      }),
    },
    itemOpen: {
      borderColor: colors.primaryAlpha40,
      ...Platform.select({
        web: {
          boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 6px rgba(0,0,0,0.04)',
        },
      }),
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isMobile ? 16 : 22,
      paddingHorizontal: isMobile ? 18 : 28,
      minHeight: 62,
      gap: 16,
      ...Platform.select({
        web: {
          transition: 'background-color 0.18s ease',
          cursor: 'pointer',
        } as any,
      }),
    },
    itemHeaderHover: {
      backgroundColor: colors.primarySoft,
    },
    itemHeaderOpen: {
      backgroundColor: colors.primarySoft,
    },
    question: {
      flex: 1,
      fontSize: isMobile ? 15 : 17,
      fontWeight: '700',
      color: colors.text,
      lineHeight: isMobile ? 22 : 26,
      letterSpacing: -0.3,
    },
    questionOpen: {
      color: colors.primary,
    },
    toggleWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexShrink: 0,
      ...Platform.select({
        web: { transition: 'background-color 0.18s ease, border-color 0.18s ease' },
      }),
    },
    toggleWrapOpen: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    answerWrap: {
      paddingHorizontal: isMobile ? 18 : 28,
      paddingBottom: isMobile ? 18 : 24,
      paddingTop: 2,
      ...Platform.select({
        web: {
          overflow: 'hidden',
          maxHeight: 300,
          opacity: 1,
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, padding 0.3s ease',
        },
      }),
    },
    answerWrapCollapsed: {
      ...Platform.select({
        web: {
          maxHeight: 0,
          opacity: 0,
          paddingBottom: 0,
          paddingTop: 0,
        },
      }),
    },
    answer: {
      fontSize: isMobile ? 14 : 15,
      lineHeight: isMobile ? 22 : 26,
      color: colors.textMuted,
      letterSpacing: 0.1,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.band} testID="home-faq">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>

          <Text style={styles.title}>Всё, что нужно знать</Text>
          <Text style={styles.subtitle}>Ответы на самые частые вопросы о сервисе</Text>
        </View>

        <View style={styles.inner}>
          <View style={styles.list}>
            {items.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <View key={item.q} style={[styles.item, isOpen && styles.itemOpen]}>
                  <Pressable
                    onPress={() => toggleItem(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={item.q}
                    accessibilityState={{ expanded: isOpen }}
                    accessibilityHint={isOpen ? 'Свернуть ответ' : 'Развернуть ответ'}
                    style={({ pressed, hovered }) => [
                      styles.itemHeader,
                      isOpen && styles.itemHeaderOpen,
                      !isOpen && (pressed || hovered) && Platform.OS === 'web' ? styles.itemHeaderHover : null,
                    ]}
                  >
                    <Text style={[styles.question, isOpen && styles.questionOpen]}>{item.q}</Text>
                    <View style={[styles.toggleWrap, isOpen && styles.toggleWrapOpen]}>
                      <Feather
                        name={isOpen ? 'minus' : 'plus'}
                        size={16}
                        color={isOpen ? colors.textOnPrimary : colors.textMuted}
                      />
                    </View>
                  </Pressable>

                  {Platform.OS === 'web' ? (
                    <View style={[styles.answerWrap, !isOpen && styles.answerWrapCollapsed]}>
                      <Text style={styles.answer}>{item.a}</Text>
                    </View>
                  ) : isOpen ? (
                    <View style={styles.answerWrap}>
                      <Text style={styles.answer}>{item.a}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  );
}

export default memo(HomeFAQSection);
