import React from 'react';
import { View, StyleSheet } from 'react-native';
import Button, { type ButtonProps } from '@/components/ui/Button';

interface ButtonComponentProps extends Pick<ButtonProps, 'label' | 'onPress' | 'disabled'> {}

const ButtonComponent: React.FC<ButtonComponentProps> = ({ label, onPress, disabled }) => (
  <View style={styles.container}>
    <Button label={label} onPress={onPress} disabled={disabled} fullWidth />
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'stretch',
    width: '100%',
  },
});

export default ButtonComponent;
