// AND-09: Единообразная обёртка KeyboardAvoidingView для Android/iOS
// На Android используется behavior="height", на iOS — "padding"
// Автоматический keyboardVerticalOffset для каждой платформы

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';

interface KeyboardAwareContainerProps {
  children: React.ReactNode;
  /** Дополнительный offset для клавиатуры (добавляется к платформенному значению) */
  extraOffset?: number;
  /** Включить ScrollView внутри (по умолчанию false) */
  scrollable?: boolean;
  /** Стиль контейнера */
  style?: StyleProp<ViewStyle>;
  /** Стиль контента ScrollView */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** testID для тестирования */
  testID?: string;
}

/**
 * AND-09: KeyboardAwareContainer
 *
 * Кроссплатформенная обёртка для корректной обработки клавиатуры:
 * - Android: behavior="height" (behavior="padding" ведёт себя некорректно на Android)
 * - iOS: behavior="padding"
 * - Web: без KeyboardAvoidingView (не нужен)
 *
 * Для Android также рекомендуется `android.softwareKeyboardLayoutMode: "resize"` в app.json
 */
export const KeyboardAwareContainer: React.FC<KeyboardAwareContainerProps> = ({
  children,
  extraOffset = 0,
  scrollable = false,
  style,
  contentContainerStyle,
  testID,
}) => {
  // На web KeyboardAvoidingView не нужен
  if (Platform.OS === 'web') {
    if (scrollable) {
      return (
        <ScrollView
          style={[styles.flex, style]}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          testID={testID}
        >
          {children}
        </ScrollView>
      );
    }
    return <>{children}</>;
  }

  const behavior = Platform.OS === 'ios' ? 'padding' : 'height';

  // Базовые offsets: iOS обычно нужен offset для navigation bar
  const baseOffset = Platform.OS === 'ios' ? 90 : 0;
  const keyboardVerticalOffset = baseOffset + extraOffset;

  const content = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
      testID={testID}
    >
      {content}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default KeyboardAwareContainer;

