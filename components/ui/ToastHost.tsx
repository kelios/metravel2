import React from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

export default function ToastHost() {
  if (Platform.OS === 'web') return null;
  return <Toast />;
}
