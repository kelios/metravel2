import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ValidationMessageProps {
  type: 'error' | 'warning';
  messages: string[];
}

const ValidationMessage: React.FC<ValidationMessageProps> = ({ type, messages }) => {
  if (messages.length === 0) return null;

  const isError = type === 'error';
  const iconName = isError ? 'error' : 'warning';
  const iconColor = isError ? '#d94b4b' : '#ff9800';

  return (
    <View style={[styles.container, isError ? styles.errorContainer : styles.warningContainer]}>
      <Icon name={iconName} size={18} color={iconColor} style={styles.icon} />
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  errorContainer: {
    backgroundColor: '#fff5f5',
    borderColor: '#ffcdd2',
  },
  warningContainer: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffe082',
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
    color: '#c62828',
  },
  warningText: {
    color: '#f57c00',
  },
});

export default ValidationMessage;
