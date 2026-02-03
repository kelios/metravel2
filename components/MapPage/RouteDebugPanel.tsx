/**
 * Тестовый компонент для диагностики отрисовки линии маршрута
 * Добавьте этот компонент на страницу карты для тестирования
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouteStore } from '@/stores/routeStore';

export const RouteDebugPanel: React.FC = () => {
  const routeStore = useRouteStore();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    addLog(`Points: ${routeStore.points.length}`);
    if (routeStore.points.length > 0) {
      addLog(`First: [${routeStore.points[0]?.coordinates.lng}, ${routeStore.points[0]?.coordinates.lat}]`);
    }
    if (routeStore.points.length > 1) {
      addLog(`Last: [${routeStore.points[routeStore.points.length - 1]?.coordinates.lng}, ${routeStore.points[routeStore.points.length - 1]?.coordinates.lat}]`);
    }
  }, [routeStore.points]);

  const testMinskToVitebsk = () => {
    addLog('Testing Minsk → Vitebsk');
    routeStore.clearRoute();

    // Минск
    routeStore.addPoint(
      { lat: 53.9006, lng: 27.5590 },
      'Минск'
    );

    // Витебск
    routeStore.addPoint(
      { lat: 55.1904, lng: 30.2049 },
      'Витебск'
    );
  };

  const testBrestToGomel = () => {
    addLog('Testing Brest → Gomel');
    routeStore.clearRoute();

    // Брест
    routeStore.addPoint(
      { lat: 52.0977, lng: 23.6847 },
      'Брест'
    );

    // Гомель
    routeStore.addPoint(
      { lat: 52.4345, lng: 30.9754 },
      'Гомель'
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔍 Route Debug Panel</Text>

      <View style={styles.stats}>
        <Text style={styles.stat}>Points: {routeStore.points.length}</Text>
        <Text style={styles.stat}>Mode: {routeStore.mode}</Text>
        <Text style={styles.stat}>Transport: {routeStore.transportMode}</Text>
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
            routeStore.clearRoute();
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
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
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
    color: '#666',
    marginBottom: 4,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  logs: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },
  logsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  log: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});
