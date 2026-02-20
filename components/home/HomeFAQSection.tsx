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
        q: 'Можно ли вести поездки только для себя?',
        a: 'Да. Вы сами решаете, что публиковать, а что оставить личным в своей книге путешествий.',
      },
      {
        q: 'Как быстро собрать книгу из поездок?',
        a: 'Откройте раздел «Экспорт», выберите нужные поездки и стиль оформления, затем скачайте готовый PDF.',
      },
      {
        q: 'Подходит ли PDF для печати?',
        a: 'Да. Книга формируется в печатном формате: можно сохранить файл или отправить его в типографию.',
      },
      {
        q: 'Нужна ли регистрация для просмотра маршрутов?',
        a: 'Смотреть маршруты можно без регистрации. Регистрация нужна, если хотите сохранять поездки и собирать свою книгу.',
      },
      {
        q: 'Можно ли сделать книгу из одной поездки?',
        a: 'Да. Вы можете собрать книгу как из одной поездки, так и из целой серии путешествий.',
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
      paddingVertical: isMobile ? 36 : 52,
      backgroundColor: colors.background,
    },
    inner: {
      maxWidth: 720,
      alignSelf: 'center',
      width: '100%',
    },
    header: {
      alignItems: 'center',
      marginBottom: isMobile ? 20 : 28,
      gap: 8,
    },
    title: {
      fontSize: isMobile ? 24 : 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: isMobile ? 14 : 16,
      lineHeight: isMobile ? 20 : 24,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 560,
    },
    list: {
      gap: isMobile ? 8 : 10,
    },
    item: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        },
      }),
    },
    itemOpen: {
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 12px ${colors.primaryAlpha30}`,
        },
      }),
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 18,
      paddingHorizontal: 20,
      minHeight: 52,
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
    question: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
    },
    chevronWrap: {
      width: 28,
      height: 28,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chevronWrapOpen: {
      backgroundColor: colors.primaryLight,
    },
    answerWrap: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    answer: {
      fontSize: 15,
      lineHeight: 24,
      color: colors.textMuted,
    },
  }), [colors, isMobile]);

  return (
    <View style={styles.band} testID="home-faq">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <Text style={styles.title}>FAQ</Text>
          <Text style={styles.subtitle}>Коротко о самом важном</Text>
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
                      (pressed || hovered) && Platform.OS === 'web' ? styles.itemHeaderHover : null,
                    ]}
                  >
                    <Text style={styles.question}>{item.q}</Text>
                    <View style={[styles.chevronWrap, isOpen && styles.chevronWrapOpen]}>
                      <Feather
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={isOpen ? colors.primary : colors.textMuted}
                      />
                    </View>
                  </Pressable>

                  {isOpen ? (
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
