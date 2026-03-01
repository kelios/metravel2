import React, { useMemo, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
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
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  const { isSmallPhone, isPhone } = useResponsive();
  const isMobile = isSmallPhone || isPhone;

  const styles = useMemo(() => StyleSheet.create({
    band: {
      width: '100%',
      alignSelf: 'stretch',
      paddingTop: isMobile ? 28 : 56,
      paddingBottom: isMobile ? 24 : 48,
      backgroundColor: colors.backgroundSecondary,
      ...Platform.select({
        web: {
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.borderLight,
        },
      }),
    },
    inner: {
      maxWidth: 720,
      alignSelf: 'center',
      width: '100%',
    },
    header: {
      alignItems: 'center',
      marginBottom: isMobile ? 20 : 36,
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
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: isMobile ? 22 : 36,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -0.8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 20 : 24,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 480,
    },
    list: {
      gap: isMobile ? 10 : 12,
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
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        },
      }),
    },
    itemOpen: {
      borderColor: colors.primaryAlpha40,
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.medium,
        },
      }),
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isMobile ? 16 : 22,
      paddingHorizontal: isMobile ? 16 : 28,
      minHeight: 64,
      gap: 16,
      ...Platform.select({
        web: {
          transition: 'background-color 0.2s ease',
          cursor: 'pointer',
          touchAction: 'pan-y',
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
      lineHeight: isMobile ? 21 : 25,
      letterSpacing: -0.2,
    },
    questionOpen: {
      color: colors.primary,
    },
    toggleWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexShrink: 0,
    },
    toggleWrapOpen: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    answerWrap: {
      paddingHorizontal: isMobile ? 16 : 28,
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
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 21 : 26,
      color: colors.textMuted,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.band} testID="home-faq">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <View style={styles.eyebrow}>
            <Feather name="help-circle" size={12} color={colors.primaryText} />
            <Text style={styles.eyebrowText}>Частые вопросы</Text>
          </View>
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
