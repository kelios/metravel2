import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

interface ResponsiveWizardLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarPosition?: 'left' | 'right';
  sidebarWidth?: number;
  showSidebarOnMobile?: boolean;
  contentMaxWidth?: number;
}

/**
 * Responsive layout wrapper for wizard steps.
 * Provides adaptive layout with optional sidebar for desktop.
 */
export function ResponsiveWizardLayout({
  children,
  sidebar,
  sidebarPosition = 'right',
  sidebarWidth = 320,
  showSidebarOnMobile = false,
  contentMaxWidth = METRICS.containers.lg,
}: ResponsiveWizardLayoutProps) {
  const { isDesktop, isTablet, isMobile, width } = useResponsive();

  const showSidebar = sidebar && (isDesktop || (isTablet && showSidebarOnMobile));

  const styles = useMemo(() => createStyles({
    isDesktop,
    isTablet,
    isMobile,
    sidebarWidth,
    contentMaxWidth,
    sidebarPosition,
  }), [isDesktop, isTablet, isMobile, sidebarWidth, contentMaxWidth, sidebarPosition]);

  if (!showSidebar) {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainContent}>
          {children}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {sidebarPosition === 'left' && (
        <View style={styles.sidebar}>
          <ScrollView
            style={styles.sidebarScroll}
            showsVerticalScrollIndicator={false}
          >
            {sidebar}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mainContent}>
          {children}
        </View>
      </ScrollView>

      {sidebarPosition === 'right' && (
        <View style={styles.sidebar}>
          <ScrollView
            style={styles.sidebarScroll}
            showsVerticalScrollIndicator={false}
          >
            {sidebar}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

interface CreateStylesOptions {
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  sidebarWidth: number;
  contentMaxWidth: number;
  sidebarPosition: 'left' | 'right';
}

const createStyles = (options: CreateStylesOptions) =>
  StyleSheet.create({
    container: {
      flex: 1,
      flexDirection: 'row',
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: options.isMobile
        ? DESIGN_TOKENS.spacing.sm
        : options.isTablet
          ? DESIGN_TOKENS.spacing.md
          : DESIGN_TOKENS.spacing.lg,
      paddingVertical: DESIGN_TOKENS.spacing.md,
    },
    mainContent: {
      flex: 1,
      maxWidth: options.isMobile ? '100%' : options.contentMaxWidth,
      width: '100%',
      alignSelf: 'center',
    },
    sidebar: {
      width: options.sidebarWidth,
      borderLeftWidth: options.sidebarPosition === 'right' ? 1 : 0,
      borderRightWidth: options.sidebarPosition === 'left' ? 1 : 0,
      borderColor: DESIGN_TOKENS.colors.border,
      backgroundColor: DESIGN_TOKENS.colors.surfaceMuted,
    },
    sidebarScroll: {
      flex: 1,
      padding: DESIGN_TOKENS.spacing.md,
    },
  });

/**
 * Step progress sidebar component for desktop
 */
interface StepProgressSidebarProps {
  currentStep: number;
  totalSteps: number;
  stepConfig: Array<{
    id: number;
    title: string;
    subtitle?: string;
  }>;
  onStepSelect?: (step: number) => void;
  completedSteps?: number[];
}

export function StepProgressSidebar({
  currentStep,
  totalSteps,
  stepConfig,
  onStepSelect,
  completedSteps = [],
}: StepProgressSidebarProps) {
  return (
    <View style={sidebarStyles.container}>
      {stepConfig.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.includes(step.id) || step.id < currentStep;
        const isClickable = !!onStepSelect && (isCompleted || step.id <= currentStep + 1);

        return (
          <View
            key={step.id}
            style={[
              sidebarStyles.stepItem,
              isActive && sidebarStyles.stepItemActive,
            ]}
            onTouchEnd={() => isClickable && onStepSelect?.(step.id)}
            accessibilityRole="button"
            accessibilityLabel={`Шаг ${step.id}: ${step.title}`}
            accessibilityState={{ selected: isActive }}
          >
            <View style={[
              sidebarStyles.stepNumber,
              isActive && sidebarStyles.stepNumberActive,
              isCompleted && sidebarStyles.stepNumberCompleted,
            ]}>
              {isCompleted && !isActive ? (
                <View style={sidebarStyles.checkmark} />
              ) : (
                <View style={sidebarStyles.stepNumberText}>
                  {/* Number shown via text */}
                </View>
              )}
            </View>

            <View style={sidebarStyles.stepContent}>
              <View style={[
                sidebarStyles.stepTitle,
                isActive && sidebarStyles.stepTitleActive,
              ]}>
                {/* Title would be Text component */}
              </View>
              {step.subtitle && (
                <View style={sidebarStyles.stepSubtitle}>
                  {/* Subtitle would be Text component */}
                </View>
              )}
            </View>

            {index < stepConfig.length - 1 && (
              <View style={[
                sidebarStyles.connector,
                isCompleted && sidebarStyles.connectorCompleted,
              ]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  container: {
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  stepItemActive: {
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  stepNumberActive: {
    borderColor: DESIGN_TOKENS.colors.primary,
    backgroundColor: DESIGN_TOKENS.colors.primary,
  },
  stepNumberCompleted: {
    borderColor: DESIGN_TOKENS.colors.success,
    backgroundColor: DESIGN_TOKENS.colors.successSoft,
  },
  stepNumberText: {
    // Placeholder for text styling
  },
  checkmark: {
    width: 12,
    height: 12,
    // Would use an icon here
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    // Placeholder for title styling
  },
  stepTitleActive: {
    // Active title styling
  },
  stepSubtitle: {
    // Subtitle styling
  },
  connector: {
    position: 'absolute',
    left: 13,
    top: 36,
    width: 2,
    height: 20,
    backgroundColor: DESIGN_TOKENS.colors.border,
  },
  connectorCompleted: {
    backgroundColor: DESIGN_TOKENS.colors.success,
  },
});

export default ResponsiveWizardLayout;

