import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle, AlertTriangle } from 'lucide-react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface ValidationMessageProps {
  type: 'error' | 'warning';
  messages: string[];
}

const ValidationMessage: React.FC<ValidationMessageProps> = ({ type, messages }) => {
  const colors = useThemedColors();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
    },
    errorContainer: {
      backgroundColor: colors.dangerLight,
      borderColor: colors.danger,
    },
    warningContainer: {
      backgroundColor: colors.warningLight,
      borderColor: colors.warning,
    },
    icon: {
      marginRight: 8,
      marginTop: 2,
    },
    textContainer: {
      flex: 1,
    },
    text: {
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 4,
    },
    errorText: {
      color: colors.dangerDark,
    },
    warningText: {
      color: colors.warningDark,
    },
  }), [colors]);

  if (messages.length === 0) return null;

  const isError = type === 'error';
  const IconComponent = isError ? AlertCircle : AlertTriangle;
  const iconColor = isError ? colors.danger : colors.warning;

  return (
    <View style={[styles.container, isError ? styles.errorContainer : styles.warningContainer]}>
      <IconComponent size={18} color={iconColor} style={styles.icon} {...({} as any)} />
      <View style={styles.textContainer}>
        {messages.map((message, index) => (
          <Text key={index} style={[styles.text, isError ? styles.errorText : styles.warningText]}>
            {message}
          </Text>
        ))}
      </View>
    </View>
  );
};

export default ValidationMessage;
