// src/utils/monitoring.ts
// ✅ Утилита для интеграции с системами мониторинга (Sentry, LogRocket и т.д.)

import { setMonitoringService, MonitoringService } from './logger';

/**
 * Инициализирует Sentry (если установлен)
 */
export const initSentry = async (): Promise<void> => {
  try {
    // Проверяем, установлен ли Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      const Sentry = (window as any).Sentry;
      
      const sentryService: MonitoringService = {
        captureException: (error: Error, context?: Record<string, any>) => {
          Sentry.captureException(error, { extra: context });
        },
        captureMessage: (message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, any>) => {
          Sentry.captureMessage(message, { level, extra: context });
        },
        setUser: (user: { id?: string; email?: string; username?: string }) => {
          Sentry.setUser(user);
        },
        setContext: (key: string, context: Record<string, any>) => {
          Sentry.setContext(key, context);
        },
      };
      
      setMonitoringService(sentryService);
      console.log('[Monitoring] Sentry initialized');
    }
  } catch (error) {
    console.error('[Monitoring] Failed to initialize Sentry:', error);
  }
};

/**
 * Инициализирует LogRocket (если установлен)
 */
export const initLogRocket = async (): Promise<void> => {
  try {
    // Проверяем, установлен ли LogRocket
    if (typeof window !== 'undefined' && (window as any).LogRocket) {
      const LogRocket = (window as any).LogRocket;
      
      const logRocketService: MonitoringService = {
        captureException: (error: Error, context?: Record<string, any>) => {
          LogRocket.captureException(error, { extra: context });
        },
        captureMessage: (message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, any>) => {
          if (level === 'error') {
            LogRocket.captureMessage(message, { extra: context });
          }
        },
        setUser: (user: { id?: string; email?: string; username?: string }) => {
          LogRocket.identify(user.id, {
            email: user.email,
            name: user.username,
          });
        },
        setContext: (key: string, context: Record<string, any>) => {
          LogRocket.setContext(key, context);
        },
      };
      
      setMonitoringService(logRocketService);
      console.log('[Monitoring] LogRocket initialized');
    }
  } catch (error) {
    console.error('[Monitoring] Failed to initialize LogRocket:', error);
  }
};

/**
 * Инициализирует все доступные системы мониторинга
 */
export const initMonitoring = async (): Promise<void> => {
  await Promise.all([
    initSentry(),
    initLogRocket(),
  ]);
};

