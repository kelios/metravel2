/**
 * ResponsiveLayout - главный layout компонент с sidebar и main area
 * Автоматически адаптируется под размер экрана
 */

import React from 'react';
import { View, StyleSheet, ScrollView, Platform, ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  sidebarWidth?: number;
  backgroundColor?: string;
  scrollable?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export default function ResponsiveLayout({
  children,
  sidebar,
  header,
  footer,
  maxWidth = 1400,
  sidebarWidth = 280,
  backgroundColor = DESIGN_TOKENS.colors.surface,
  scrollable = true,
  style,
  testID,
}: ResponsiveLayoutProps) {
  const { isTablet, isLargeTablet, isDesktop, width } = useResponsive();

  // Показываем sidebar только на больших экранах
  const showSidebar = sidebar && (isLargeTablet || isDesktop);

  const sidebarWebStyle = Platform.OS === 'web' ? {
    position: 'sticky' as const,
    top: 0,
    alignSelf: 'flex-start' as const,
    maxHeight: '100vh' as any,
    overflowY: 'auto' as any,
    zIndex: 10,
  } : {};

  const content = (
    <View style={[styles.wrapper, { backgroundColor }]}>
      {header}
      
      <View
        style={[
          styles.content,
          { maxWidth },
          Platform.OS === 'web' && styles.contentWeb,
        ]}
      >
        {showSidebar && (
          <View style={[styles.sidebar, { width: sidebarWidth }, sidebarWebStyle]}>
            {sidebar}
          </View>
        )}
        
        <View style={styles.main}>
          {children}
        </View>
      </View>

      {footer}
    </View>
  );

  if (!scrollable) {
    return (
      <View style={[styles.container, style]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={Platform.OS === 'web' ? 32 : 16}
      testID={testID}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  wrapper: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: METRICS.spacing.m,
  },
  contentWeb: {
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingHorizontal: METRICS.spacing.l,
  },
  sidebar: {
    paddingRight: METRICS.spacing.l,
    paddingTop: METRICS.spacing.m,
  },
  main: {
    flex: 1,
    padding: METRICS.spacing.m,
    ...Platform.select({
      web: {
        paddingLeft: METRICS.spacing.l,
      },
    }),
  },
});
