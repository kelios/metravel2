// Компонент для мониторинга производительности
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { usePerformanceMonitoring, logPerformanceMetrics, PerformanceMetrics } from '@/hooks/usePerformanceMonitoring';

interface PerformanceMonitorProps {
  enabled?: boolean;
  showUI?: boolean;
  onMetricsReady?: (metrics: any) => void;
}

export default function PerformanceMonitor({
  enabled = __DEV__,
  showUI = false,
  onMetricsReady,
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMetricsRef = useRef<PerformanceMetrics>({});

  // ✅ FIX: Дебаунсим обновления чтобы избежать бесконечных обновлений
  const handleMetricsReady = useCallback((newMetrics: PerformanceMetrics) => {
    // Сохраняем новые метрики в ref
    pendingMetricsRef.current = { ...pendingMetricsRef.current, ...newMetrics };
    
    // Очищаем предыдущий таймер
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Дебаунсим обновление состояния (батчим несколько обновлений в одно)
    updateTimeoutRef.current = setTimeout(() => {
      const finalMetrics = { ...pendingMetricsRef.current };
      
      // ✅ FIX: Обновляем состояние только если метрики действительно изменились
      setMetrics((prev) => {
        // Проверяем, есть ли реальные изменения
        const hasChanges = Object.keys(finalMetrics).some(
          (key) => prev[key as keyof PerformanceMetrics] !== finalMetrics[key as keyof PerformanceMetrics]
        );
        
        if (!hasChanges) {
          return prev; // Возвращаем предыдущее состояние, чтобы избежать лишнего рендера
        }
        
        return { ...prev, ...finalMetrics };
      });
      
      logPerformanceMetrics(finalMetrics);
      if (onMetricsReady) {
        onMetricsReady(finalMetrics);
      }
      pendingMetricsRef.current = {};
    }, 100); // Батчим обновления в течение 100ms
  }, [onMetricsReady]);

  // ✅ УЛУЧШЕНИЕ: Используем новый хук мониторинга производительности
  usePerformanceMonitoring(handleMetricsReady, enabled);

  // ✅ FIX: Очищаем таймер при размонтировании
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  if (!enabled || Platform.OS !== 'web') return null;

  if (!showUI) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Performance Metrics</Text>
      {metrics.lcp && (
        <Text style={styles.metric}>
          LCP: {metrics.lcp.toFixed(2)}ms
          {metrics.lcp < 2500 ? ' ✅' : metrics.lcp < 4000 ? ' ⚠️' : ' ❌'}
        </Text>
      )}
      {metrics.fcp && (
        <Text style={styles.metric}>
          FCP: {metrics.fcp.toFixed(2)}ms
          {metrics.fcp < 1800 ? ' ✅' : ' ⚠️'}
        </Text>
      )}
      {metrics.fid && (
        <Text style={styles.metric}>
          FID: {metrics.fid.toFixed(2)}ms
          {metrics.fid < 100 ? ' ✅' : ' ⚠️'}
        </Text>
      )}
      {metrics.cls !== undefined && (
        <Text style={styles.metric}>
          CLS: {metrics.cls.toFixed(4)}
          {metrics.cls < 0.1 ? ' ✅' : metrics.cls < 0.25 ? ' ⚠️' : ' ❌'}
        </Text>
      )}
      {metrics.ttfb && (
        <Text style={styles.metric}>
          TTFB: {metrics.ttfb.toFixed(2)}ms
          {metrics.ttfb < 800 ? ' ✅' : ' ⚠️'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    zIndex: 9999,
    minWidth: 200,
    ...Platform.select({
      web: {
        fontFamily: 'monospace',
        fontSize: 12,
      },
    }),
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 14,
  },
  metric: {
    color: '#fff',
    marginBottom: 4,
    fontSize: 12,
  },
});

