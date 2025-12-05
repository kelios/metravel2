import React, { memo } from 'react';
import { View, Platform, type ViewProps } from 'react-native';

export interface SemanticViewProps extends ViewProps {
  as?: 'main' | 'nav' | 'header' | 'footer' | 'article' | 'section' | 'aside';
  children: React.ReactNode;
}

/**
 * Semantic View компонент для улучшения HTML семантики на web
 * 
 * На web рендерит правильные HTML5 теги (main, nav, header, etc.)
 * На mobile рендерит обычный View с правильными accessibility props
 * 
 * @example
 * <SemanticView as="main">
 *   <Content />
 * </SemanticView>
 * 
 * <SemanticView as="nav">
 *   <Navigation />
 * </SemanticView>
 */
function SemanticView({ as = 'section', children, ...props }: SemanticViewProps) {
  if (Platform.OS === 'web') {
    // На web используем правильные HTML теги
    const Component = as as any;
    return <Component {...props}>{children}</Component>;
  }

  // На mobile используем View с accessibility
  const accessibilityRole = getAccessibilityRole(as);
  
  return (
    <View {...props} accessibilityRole={accessibilityRole}>
      {children}
    </View>
  );
}

function getAccessibilityRole(tag: string): ViewProps['accessibilityRole'] {
  // React Native поддерживает ограниченный набор accessibility roles
  // Используем ближайшие аналоги
  const roleMap: Record<string, ViewProps['accessibilityRole']> = {
    main: undefined, // main не поддерживается, используем default
    nav: 'menu',
    header: 'header',
    footer: undefined,
    article: undefined,
    section: undefined,
    aside: undefined,
  };

  return roleMap[tag];
}

export default memo(SemanticView);
