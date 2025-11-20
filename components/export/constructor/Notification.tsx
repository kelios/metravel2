// components/export/constructor/Notification.tsx
// ✅ АРХИТЕКТУРА: Компонент уведомлений

import React, { useEffect, useState } from 'react';

interface NotificationProps {
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
  onClose?: () => void;
}

export function Notification({ message, type = 'info', duration = 3000, onClose }: NotificationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onClose?.(), 300); // Ждем завершения анимации
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!visible) return null;

  const colors = {
    success: { bg: '#10b981', text: '#fff' },
    info: { bg: '#3b82f6', text: '#fff' },
    warning: { bg: '#f59e0b', text: '#fff' },
    error: { bg: '#ef4444', text: '#fff' },
  };

  const color = colors[type];

  return (
    <div
      className="notification-slide-in"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        backgroundColor: color.bg,
        color: color.text,
        padding: '12px 20px',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 10000,
        maxWidth: 300,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{message}</span>
        {onClose && (
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(() => onClose(), 300);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: color.text,
              cursor: 'pointer',
              marginLeft: 12,
              fontSize: 18,
              lineHeight: 1,
              opacity: 0.8,
            }}
          >
            ×
          </button>
        )}
      </div>
      <style>{`
        .notification-slide-in {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

