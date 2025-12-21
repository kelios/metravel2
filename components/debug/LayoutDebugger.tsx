// LayoutDebugger.tsx
// Компонент для визуальной отладки отступов и границ

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LayoutDebuggerProps {
  children: React.ReactNode;
  label?: string;
  showBorders?: boolean;
}

export default function LayoutDebugger({ 
  children, 
  label = 'Debug Container',
  showBorders = true 
}: LayoutDebuggerProps) {
  if (!__DEV__) return <>{children}</>;

  return (
    <View style={[styles.container, showBorders && styles.debugBorder]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  debugBorder: {
    borderWidth: 2,
    borderColor: '#ff0000',
    borderStyle: 'dashed',
  },
  labelContainer: {
    position: 'absolute',
    top: -10,
    left: 10,
    backgroundColor: '#ff0000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1000,
  },
  label: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    width: '100%',
  },
});
