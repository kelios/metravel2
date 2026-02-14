import React, { useMemo, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';
import { useThemedColors } from '@/hooks/useTheme';

type FaqItem = {
  q: string;
  a: string;
};

function HomeFAQSection() {
  const colors = useThemedColors(); // ✅ РЕДИЗАЙН: Темная тема

  const items = useMemo<FaqItem[]>(
    () => [
      {
        q: 'Можно ли писать приватно?',
        a: 'Да. Ты сам решаешь, какие путешествия публиковать. Остальное может оставаться личным.',
      },
      {
        q: 'Как собрать книгу из поездок?',
        a: 'Открой “Экспорт”, выбери нужные истории, стиль оформления и сформируй PDF-книгу.',
      },
      {
        q: 'Можно ли распечатать книгу?',
        a: 'Да. PDF формируется в удобном формате для печати — можно сохранить или отправить в типографию.',
      },
      {
        q: 'Нужно ли регистрироваться?',
        a: 'Для создания и сохранения путешествий — да. Читать маршруты и вдохновляться можно и без регистрации.',
      },
      {
        q: 'Можно ли экспортировать одну поездку?',
        a: 'Да. Можно собрать книгу как из одной истории, так и из нескольких поездок.',
      },
    ],
    []
  );

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = useCallback((idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    band: {
      width: '100%',
      alignSelf: 'stretch',
      paddingVertical: 72,
      backgroundColor: colors.background,
    },
    inner: {
      maxWidth: 720,
      alignSelf: 'center',
      width: '100%',
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
      gap: 12,
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 560,
    },
    list: {
      gap: 10,
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
  }), [colors]);

  return (
    <View style={styles.band} testID="home-faq">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <Text style={styles.title}>FAQ</Text>
          <Text style={styles.subtitle}>Короткие ответы на частые вопросы</Text>
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
