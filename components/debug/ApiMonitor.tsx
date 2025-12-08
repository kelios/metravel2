import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface ApiRequest {
  url: string;
  method: string;
  status: number | null;
  duration: number;
  timestamp: Date;
}

const ApiMonitor: React.FC = () => {
  const [requests, setRequests] = useState<ApiRequest[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !window.location.hostname.includes('localhost')) {
        return;
    }

    // Перехватываем fetch запросы
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const start = performance.now();
      const url = typeof args[0] === 'string' ? args[0] : 
               args[0] instanceof URL ? args[0].href : 
               ('url' in args[0] ? args[0].url : String(args[0]));
      const method = typeof args[1] === 'object' ? args[1].method || 'GET' : 'GET';
      
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - start;
        
        // Добавляем запрос в монитор
        setRequests(prev => [
          ...prev.slice(-9), // Оставляем только последние 10 запросов
          {
            url,
            method,
            status: response.status,
            duration: Math.round(duration),
            timestamp: new Date()
          }
        ]);
        
        return response;
      } catch (error) {
        const duration = performance.now() - start;
        
        setRequests(prev => [
          ...prev.slice(-9),
          {
            url,
            method,
            status: null,
            duration: Math.round(duration),
            timestamp: new Date()
          }
        ]);
        
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (Platform.OS !== 'web' || !window.location.hostname.includes('localhost')) {
    return <View />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API Monitor (Last 10 requests)</Text>
      {requests.map((req, index) => (
        <View key={index} style={styles.request}>
          <Text style={styles.method}>{req.method}</Text>
          <Text style={styles.url} numberOfLines={1}>
            {req.url.replace(window.location.origin, '')}
          </Text>
          <Text style={[
            styles.status,
            { color: req.status === null ? '#ff6b6b' : 
                    req.status < 300 ? '#51cf66' : 
                    req.status < 400 ? '#ffd43b' : '#ff6b6b' }
          ]}>
            {req.status || 'ERR'}
          </Text>
          <Text style={styles.duration}>{req.duration}ms</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 10,
    right: 10,
    width: 400,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 8,
    zIndex: 9999,
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  method: {
    color: '#fff',
    fontSize: 10,
    width: 40,
  },
  url: {
    color: '#fff',
    fontSize: 10,
    flex: 1,
    marginHorizontal: 5,
  },
  status: {
    fontSize: 10,
    width: 30,
    textAlign: 'center',
  },
  duration: {
    color: '#fff',
    fontSize: 10,
    width: 40,
    textAlign: 'right',
  },
});

export default ApiMonitor;
