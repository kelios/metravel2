/**
 * Тестовый компонент для диагностики отрисовки линии маршрута
 * Добавьте этот компонент на страницу карты для тестирования
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouteStore } from '@/stores/routeStore';
import { DESIGN_TOKENS } from '@/constants/designSystem';

export const RouteDebugPanel: React.FC = () => {
  // P4.2: Гранулярные селекторы вместо подписки на весь store
  const points = useRouteStore((s) => s.points);
  const mode = useRouteStore((s) => s.mode);
  const transportMode = useRouteStore((s) => s.transportMode);
  const clearRoute = useRouteStore((s) => s.clearRoute);
  const addPoint = useRouteStore((s) => s.addPoint);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog(`Points: ${points.length}`);
    if (points.length > 0) {
      addLog(`First: [${points[0]?.coordinates.lng}, ${points[0]?.coordinates.lat}]`);
    }
    if (points.length > 1) {
      addLog(`Last: [${points[points.length - 1]?.coordinates.lng}, ${points[points.length - 1]?.coordinates.lat}]`);
    }
  }, [points]);

  const testMinskToVitebsk = () => {
    addLog('Testing Minsk → Vitebsk');
    clearRoute();

    // Минск
    addPoint(
      { lat: 53.9006, lng: 27.5590 },
      'Минск'
    );

    // Витебск
    addPoint(
      { lat: 55.1904, lng: 30.2049 },
      'Витебск'
    );
  };

  const testBrestToGomel = () => {
    addLog('Testing Brest → Gomel');
    clearRoute();

    // Брест
    addPoint(
      { lat: 52.0977, lng: 23.6847 },
      'Брест'
    );

    // Гомель
    addPoint(
      { lat: 52.4345, lng: 30.9754 },
      'Гомель'
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Route Debug Panel</Text>

      <View style={styles.stats}>
        <Text style={styles.stat}>Points: {points.length}</Text>
        <Text style={styles.stat}>Mode: {mode}</Text>
        <Text style={styles.stat}>Transport: {transportMode}</Text>
        <Text style={styles.stat}>Distance: N/A</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.button} onPress={testMinskToVitebsk}>
          <Text style={styles.buttonText}>Минск → Витебск</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testBrestToGomel}>
          <Text style={styles.buttonText}>Брест → Гомель</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={() => {
            addLog('Clearing route');
            clearRoute();
          }}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logs}>
        <Text style={styles.logsTitle}>Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.log}>{log}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: DESIGN_TOKENS.colors.surfaceElevated,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.lg,
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    minWidth: 300,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  stats: {
    marginBottom: 12,
  },
  stat: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
    marginBottom: 4,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: DESIGN_TOKENS.colors.info,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  clearButton: {
    backgroundColor: DESIGN_TOKENS.colors.danger,
  },
  buttonText: {
    color: DESIGN_TOKENS.colors.textOnDark,
    fontSize: 12,
    fontWeight: '600',
  },
  logs: {
    borderTopWidth: 1,
    borderTopColor: DESIGN_TOKENS.colors.border,
    paddingTop: DESIGN_TOKENS.spacing.sm,
  },
  logsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  log: {
    fontSize: 10,
    color: DESIGN_TOKENS.colors.textMuted,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});
