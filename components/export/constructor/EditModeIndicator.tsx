// components/export/constructor/EditModeIndicator.tsx
// ✅ АРХИТЕКТУРА: Индикатор режима редактирования

import React from 'react';
import { Text } from 'react-native';

interface EditModeIndicatorProps {
  isEditing: boolean;
  blockType?: string;
}

export function EditModeIndicator({ isEditing, blockType }: EditModeIndicatorProps) {
  if (!isEditing) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#ff9f5a',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 16 }}>✏️</span>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
        Режим редактирования {blockType ? `(${blockType})` : ''}
      </Text>
      <Text style={{ fontSize: 12, color: '#fff', opacity: 0.9 }}>
        Нажмите Escape для завершения
      </Text>
    </div>
  );
}

