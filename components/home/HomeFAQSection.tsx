import React, { useMemo, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { ResponsiveContainer } from '@/components/layout';

type FaqItem = {
  q: string;
  a: string;
};

function HomeFAQSection() {
  const items = useMemo<FaqItem[]>(
    () => [
      {
        q: 'Можно ли писать приватно?'
,
        a: 'Да. Ты сам решаешь, какие путешествия публиковать. Остальное может оставаться личным.',
      },
      {
        q: 'Как собрать книгу из поездок?'
,
        a: 'Открой “Экспорт”, выбери нужные истории, стиль оформления и сформируй PDF-книгу.',
      },
      {
        q: 'Можно ли распечатать книгу?'
,
        a: 'Да. PDF формируется в удобном формате для печати — можно сохранить или отправить в типографию.',
      },
      {
        q: 'Нужно ли регистрироваться?'
,
        a: 'Для создания и сохранения путешествий — да. Читать маршруты и вдохновляться можно и без регистрации.',
      },
      {
        q: 'Можно ли экспортировать одну поездку?'
,
        a: 'Да. Можно собрать книгу как из одной истории, так и из нескольких поездок.',
      },
    ],
    []
  );

  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = useCallback((idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }, []);

  return (
    <View style={styles.band} testID="home-faq">
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <Text style={styles.title}>FAQ</Text>
          <Text style={styles.subtitle}>Короткие ответы на частые вопросы</Text>
        </View>

        <View style={styles.list}>
          {items.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <View key={item.q} style={[styles.item, isOpen && styles.itemOpen]}>
                <Pressable
                  onPress={() => toggleItem(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={item.q}
                  style={({ pressed, hovered }) => [
                    styles.itemHeader,
                    (pressed || hovered) && Platform.OS === 'web' ? styles.itemHeaderHover : null,
                  ]}
                >
                  <Text style={styles.question}>{item.q}</Text>
                  <Feather
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={DESIGN_TOKENS.colors.textMuted}
                  />
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
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 64,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: DESIGN_TOKENS.colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
    maxWidth: 560,
  },
  list: {
    gap: 12,
  },
  item: {
    width: '100%',
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.card,
      },
    }),
  },
  itemOpen: {
    borderColor: DESIGN_TOKENS.colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 16,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease',
        cursor: 'pointer',
      },
    }),
  },
  itemHeaderHover: {
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
  },
  question: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  answerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  answer: {
    fontSize: 15,
    lineHeight: 22,
    color: DESIGN_TOKENS.colors.textMuted,
  },
});

export default memo(HomeFAQSection);
