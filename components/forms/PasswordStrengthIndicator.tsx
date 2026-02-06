// components/PasswordStrengthIndicator.tsx
// ✅ Компонент для отображения силы пароля

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { checkPasswordStrength, getPasswordStrengthLabel, getPasswordStrengthColor } from '@/utils/passwordStrength';
import { useThemedColors } from '@/hooks/useTheme';

interface PasswordStrengthIndicatorProps {
  password: string;
  showFeedback?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showFeedback = true,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!password || password.length === 0) {
    return null;
  }

  const { score, feedback } = checkPasswordStrength(password);
  const label = getPasswordStrengthLabel(score);
  const color = getPasswordStrengthColor(score);

  return (
    <View style={styles.container}>
      <View style={styles.barContainer}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor: index < score ? color : colors.borderLight,
                flex: 1,
                marginRight: index < 3 ? 4 : 0,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.labelContainer}>
        <Text style={[styles.label, { color }]}>
          Сила пароля: {label}
        </Text>
      </View>
      {showFeedback && feedback.length > 0 && (
        <View style={styles.feedbackContainer}>
          {feedback.map((item, index) => (
            <Text key={index} style={styles.feedback}>
              • {item}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
  },
  barContainer: {
    flexDirection: 'row',
    height: 4,
    marginBottom: 8,
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
  labelContainer: {
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackContainer: {
    marginTop: 4,
  },
  feedback: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
});
