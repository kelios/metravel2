import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer, ResponsiveText, ResponsiveStack } from '@/components/layout';

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
  const { isSmallPhone, isPhone, isTablet, isDesktop } = useResponsive();
  const isMobile = isSmallPhone || isPhone;
  const showConnectors = isTablet || isDesktop;

  return (
    <View style={styles.container}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.header}>
          <ResponsiveText variant="h2" style={styles.title}>
            Как это работает
          </ResponsiveText>
        </View>

        <ResponsiveStack 
          direction={isMobile ? 'vertical' : 'horizontal'} 
          gap={isMobile ? 20 : 24}
          justify="space-between"
        >
          {STEPS.map((step, index) => (
            <View key={step.number} style={styles.stepWrapper}>
              <View style={styles.step}>
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

                <ResponsiveText variant="h4" style={styles.stepTitle}>
                  {step.title}
                </ResponsiveText>
                <ResponsiveText variant="body" style={styles.stepDescription}>
                  {step.description}
                </ResponsiveText>
              </View>

              {index < STEPS.length - 1 && showConnectors && (
                <View style={styles.connector}>
                  <Feather name="arrow-right" size={20} color={DESIGN_TOKENS.colors.borderLight} />
                </View>
              )}
            </View>
          ))}
        </ResponsiveStack>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 80,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
  header: {
    marginBottom: 56,
    alignItems: 'center',
  },
  title: {
    color: DESIGN_TOKENS.colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
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
        backgroundImage: 'linear-gradient(135deg, rgba(93, 140, 124, 0.15) 0%, rgba(93, 140, 124, 0.08) 100%)',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
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
    color: DESIGN_TOKENS.colors.text,
    letterSpacing: -0.2,
  },
  stepDescription: {
    color: DESIGN_TOKENS.colors.textMuted,
  },
  connector: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    opacity: 0.3,
  },
});
