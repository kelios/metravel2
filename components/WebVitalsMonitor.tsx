/**
 * Web Vitals Monitor Component
 * Displays real-time performance metrics for development/debugging
 *
 * Usage: Add to app layout in development mode
 *
 * @example
 * {__DEV__ && <WebVitalsMonitor />}
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Pressable } from 'react-native';
import { getWebVitalsMetrics, onWebVitals, checkMetricsHealth } from '@/utils/webVitalsMonitoring';
import type { WebVitalsMetrics } from '@/utils/webVitalsMonitoring';

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    bottom: 10,
    right: 10,
    width: 300,
    maxHeight: 400,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    padding: 12,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    color: '#888',
    fontSize: 16,
  },
  metric: {
    marginBottom: 8,
  },
  metricLabel: {
    color: '#888',
    fontSize: 11,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  metricStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusGood: {
    color: '#4ade80',
  },
  statusFair: {
    color: '#facc15',
  },
  statusPoor: {
    color: '#ef4444',
  },
  scrollView: {
    maxHeight: 350,
  },
});

interface WebVitalsMonitorProps {
  visible?: boolean;
  onClose?: () => void;
  showThreshold?: boolean;
}

/**
 * Metric row component
 */
const MetricRow: React.FC<{
  label: string;
  value: number | undefined;
  unit: string;
  status: 'good' | 'fair' | 'poor';
  threshold?: { good: number; fair: number };
}> = ({ label, value, unit, status, threshold }) => {
  if (value === undefined) {
    return null;
  }

  let statusStyle = styles.statusGood;
  if (status === 'fair') statusStyle = styles.statusFair;
  if (status === 'poor') statusStyle = styles.statusPoor;

  const displayValue = typeof value === 'number' ? value.toFixed(unit === 'ms' ? 0 : 3) : 'N/A';

  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {displayValue} {unit}
      </Text>
      {threshold && (
        <Text style={[styles.metricStatus, statusStyle]}>
          {status.toUpperCase()}
          {status === 'good' && ' ✓'}
          {status === 'fair' && ' ⚠'}
          {status === 'poor' && ' ✗'}
        </Text>
      )}
    </View>
  );
};

export const WebVitalsMonitor: React.FC<WebVitalsMonitorProps> = ({
  visible: controlledVisible,
  onClose,
  showThreshold = true,
}) => {
  const [metrics, setMetrics] = useState<WebVitalsMetrics>({});
  const [health, setHealth] = useState(checkMetricsHealth({}));
  const [isVisible, setIsVisible] = useState(controlledVisible ?? true);

  useEffect(() => {
    // Get initial metrics
    setMetrics(getWebVitalsMetrics());
    setHealth(checkMetricsHealth(getWebVitalsMetrics()));

    // Subscribe to updates
    const unsubscribe = onWebVitals((newMetrics) => {
      setMetrics(newMetrics);
      setHealth(checkMetricsHealth(newMetrics));
    });

    return unsubscribe;
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (Platform.OS !== 'web' || !isVisible) {
    return null;
  }

  return (
    <div style={styles.container as any}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Web Vitals</Text>
        <Pressable
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} scrollEnabled={true}>
        <MetricRow
          label="LCP"
          value={metrics.lcp}
          unit="ms"
          status={health.lcp}
          threshold={showThreshold ? { good: 2500, fair: 4000 } : undefined}
        />

        <MetricRow
          label="FID"
          value={metrics.fid}
          unit="ms"
          status={health.fid}
          threshold={showThreshold ? { good: 100, fair: 300 } : undefined}
        />

        <MetricRow
          label="CLS"
          value={metrics.cls}
          unit=""
          status={health.cls}
          threshold={showThreshold ? { good: 0.1, fair: 0.25 } : undefined}
        />

        <MetricRow
          label="FCP"
          value={metrics.fcp}
          unit="ms"
          status={health.fcp}
          threshold={showThreshold ? { good: 1800, fair: 3000 } : undefined}
        />

        <MetricRow
          label="TTFB"
          value={metrics.ttfb}
          unit="ms"
          status={health.ttfb}
          threshold={showThreshold ? { good: 600, fair: 1800 } : undefined}
        />

        {metrics.inp !== undefined && (
          <MetricRow
            label="INP"
            value={metrics.inp}
            unit="ms"
            status={health.fid}
          />
        )}
      </ScrollView>

      {/* Health summary */}
      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.2)' }}>
        <Text style={[styles.metricLabel, { marginBottom: 4 }]}>
          Overall: {health.isHealthy ? '✓ GOOD' : '⚠ NEEDS WORK'}
        </Text>
      </View>
    </div>
  );
};

export default WebVitalsMonitor;

