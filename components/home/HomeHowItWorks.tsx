import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const STEPS = [
  {
    number: 1,
    title: 'Расскажи историю',
    description: 'Опиши свой маршрут, добавь фото и впечатления о путешествии',
    icon: 'edit-3',
  },
  {
    number: 2,
    title: 'Собери в книгу',
    description: 'Выбери истории, настрой стиль и создай свою книгу путешествий',
    icon: 'book-open',
  },
  {
    number: 3,
    title: 'Поделись или сохрани',
    description: 'Покажи друзьям или сохрани в PDF на память',
    icon: 'share-2',
  },
];

export default function HomeHowItWorks() {
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      <View style={styles.header}>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>
          Как это работает
        </Text>
      </View>

      <View style={[styles.stepsContainer, isMobile && styles.stepsContainerMobile]}>
        {STEPS.map((step, index) => (
          <View key={step.number} style={styles.stepWrapper}>
            <View style={[styles.step, isMobile && styles.stepMobile]}>
              <View style={styles.stepHeader}>
                <View style={styles.iconContainer}>
                  <Feather
                    name={step.icon as any}
                    size={24}
                    color={DESIGN_TOKENS.colors.primary}
                  />
                </View>
                <View style={styles.numberBadge}>
                  <Text style={styles.numberText}>{step.number}</Text>
                </View>
              </View>

              <Text style={[styles.stepTitle, isMobile && styles.stepTitleMobile]}>
                {step.title}
              </Text>
              <Text style={[styles.stepDescription, isMobile && styles.stepDescriptionMobile]}>
                {step.description}
              </Text>
            </View>

            {index < STEPS.length - 1 && !isMobile && (
              <View style={styles.connector}>
                <Feather name="arrow-right" size={20} color={DESIGN_TOKENS.colors.borderLight} />
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 60,
    paddingVertical: 80,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
  containerMobile: {
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  header: {
    marginBottom: 56,
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: DESIGN_TOKENS.colors.text,
    lineHeight: 48,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  titleMobile: {
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  stepsContainer: {
    flexDirection: 'row',
    gap: 24,
    justifyContent: 'space-between',
  },
  stepsContainerMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  stepWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  step: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    padding: 32,
    gap: 16,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(31, 31, 31, 0.06)',
        transition: 'all 0.3s ease',
      },
    }),
  },
  stepMobile: {
    padding: 24,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        background: 'linear-gradient(135deg, rgba(93, 140, 124, 0.15) 0%, rgba(93, 140, 124, 0.08) 100%)',
      },
    }),
  },
  numberBadge: {
    width: 36,
    height: 36,
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(93, 140, 124, 0.3)',
      },
    }),
  },
  numberText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  stepTitleMobile: {
    fontSize: 18,
    lineHeight: 26,
  },
  stepDescription: {
    fontSize: 16,
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 26,
  },
  stepDescriptionMobile: {
    fontSize: 15,
    lineHeight: 24,
  },
  connector: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    opacity: 0.3,
  },
});
