import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PerformanceMonitor } from '@/utils/performanceMonitoring';

interface PerformanceMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  loadTime?: number;
}

interface PerformanceDashboardProps {
  visible?: boolean;
}

export function PerformanceDashboard({ visible = false }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;

    const monitor = new PerformanceMonitor();
    
    // Update metrics every 2 seconds
    const interval = setInterval(() => {
      const currentMetrics = monitor.getMetrics();
      setMetrics(currentMetrics);
      setSuggestions(monitor.getOptimizationSuggestions());
    }, 2000);

    return () => {
      clearInterval(interval);
      monitor.destroy();
    };
  }, [visible]);

  if (!visible) return null;

  const getMetricColor = (value: number, threshold: number) => {
    if (value <= threshold) return '#10b981'; // green
    if (value <= threshold * 2) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Performance Metrics</Text>
      
      <View style={styles.metricsGrid}>
        <MetricCard 
          label="LCP" 
          value={metrics.lcp} 
          unit="ms" 
          threshold={2500}
          color={getMetricColor(metrics.lcp || 0, 2500)}
        />
        <MetricCard 
          label="FCP" 
          value={metrics.fcp} 
          unit="ms" 
          threshold={1800}
          color={getMetricColor(metrics.fcp || 0, 1800)}
        />
        <MetricCard 
          label="FID" 
          value={metrics.fid} 
          unit="ms" 
          threshold={100}
          color={getMetricColor(metrics.fid || 0, 100)}
        />
        <MetricCard 
          label="CLS" 
          value={metrics.cls} 
          unit="" 
          threshold={0.1}
          color={getMetricColor((metrics.cls || 0) * 1000, 100)}
        />
        <MetricCard 
          label="TTFB" 
          value={metrics.ttfb} 
          unit="ms" 
          threshold={600}
          color={getMetricColor(metrics.ttfb || 0, 600)}
        />
        <MetricCard 
          label="Load Time" 
          value={metrics.loadTime} 
          unit="ms" 
          threshold={3000}
          color={getMetricColor(metrics.loadTime || 0, 3000)}
        />
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>Optimization Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <Text key={index} style={styles.suggestionText}>
              • {suggestion}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

interface MetricCardProps {
  label: string;
  value?: number;
  unit: string;
  threshold: number;
  color: string;
}

function MetricCard({ label, value, unit, threshold, color }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>
        {value ? `${value.toFixed(0)}${unit}` : '---'}
      </Text>
      <Text style={styles.metricThreshold}>
        Target: &lt;{threshold}{unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    minWidth: 300,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1000,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricThreshold: {
    fontSize: 10,
    color: '#666',
  },
  suggestions: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 16,
  },
});
