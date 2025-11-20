// components/export/constructor/PageSettingsPanel.tsx
// ✅ АРХИТЕКТУРА: Панель настройки параметров страницы

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PageFormat, PageOrientation } from '@/src/types/pdf-constructor';

interface PageSettingsPanelProps {
  format: PageFormat;
  orientation: PageOrientation;
  onUpdate: (format: PageFormat, orientation: PageOrientation, scaleBlocks: boolean) => void;
  onClose: () => void;
}

export function PageSettingsPanel({
  format,
  orientation,
  onUpdate,
  onClose,
}: PageSettingsPanelProps) {
  const [localFormat, setLocalFormat] = useState(format);
  const [localOrientation, setLocalOrientation] = useState(orientation);
  const [scaleBlocks, setScaleBlocks] = useState(true);

  const handleApply = () => {
    const message = scaleBlocks
      ? 'Блоки будут автоматически масштабированы под новый формат. Продолжить?'
      : 'Изменение формата может повлиять на расположение блоков. Продолжить?';
    
    if (window.confirm(message)) {
      onUpdate(localFormat, localOrientation, scaleBlocks);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#fff',
      padding: 24,
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 2000,
      minWidth: 300,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Параметры страницы</h3>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            Формат:
          </label>
          <select
            value={localFormat}
            onChange={(e) => setLocalFormat(e.target.value as PageFormat)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 14,
              border: '1px solid #ddd',
              borderRadius: 4,
            }}
          >
            <option value="A4">A4 (210×297 мм)</option>
            <option value="A5">A5 (148×210 мм)</option>
            <option value="A6">A6 (105×148 мм)</option>
            <option value="Letter">Letter (216×279 мм)</option>
          </select>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={scaleBlocks}
              onChange={(e) => setScaleBlocks(e.target.checked)}
              style={{ marginRight: 8, cursor: 'pointer' }}
            />
            <span>Автоматически масштабировать блоки</span>
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            Ориентация:
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Pressable
              onPress={() => setLocalOrientation('portrait')}
              style={{
                flex: 1,
                padding: 12,
                backgroundColor: localOrientation === 'portrait' ? '#ff9f5a' : '#f0f0f0',
                borderRadius: 4,
                border: '1px solid #ddd',
                cursor: 'pointer',
              }}
            >
              <Text style={{
                textAlign: 'center',
                color: localOrientation === 'portrait' ? '#fff' : '#333',
                fontWeight: localOrientation === 'portrait' ? 600 : 400,
              }}>
                Книжная
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLocalOrientation('landscape')}
              style={{
                flex: 1,
                padding: 12,
                backgroundColor: localOrientation === 'landscape' ? '#ff9f5a' : '#f0f0f0',
                borderRadius: 4,
                border: '1px solid #ddd',
                cursor: 'pointer',
              }}
            >
              <Text style={{
                textAlign: 'center',
                color: localOrientation === 'landscape' ? '#fff' : '#333',
                fontWeight: localOrientation === 'landscape' ? 600 : 400,
              }}>
                Альбомная
              </Text>
            </Pressable>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              borderRadius: 4,
              border: '1px solid #ddd',
            }}
          >
            <Text style={{ color: '#333' }}>Отмена</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9f5a',
              borderRadius: 4,
              border: 'none',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 600 }}>Применить</Text>
          </Pressable>
        </div>
      </div>
    </div>
  );
}

