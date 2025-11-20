// components/export/constructor/HelpPanel.tsx
// ✅ АРХИТЕКТУРА: Панель справки с горячими клавишами

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

interface HelpPanelProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], description: 'Отменить действие' },
  { keys: ['Ctrl', 'Shift', 'Z'], description: 'Повторить действие' },
  { keys: ['Ctrl', 'C'], description: 'Копировать блок' },
  { keys: ['Ctrl', 'V'], description: 'Вставить блок' },
  { keys: ['Delete'], description: 'Удалить блок' },
  { keys: ['Double Click'], description: 'Редактировать текст' },
  { keys: ['Escape'], description: 'Завершить редактирование' },
  { keys: ['Ctrl', 'Enter'], description: 'Завершить редактирование' },
  { keys: ['Shift', 'Drag'], description: 'Сохранить пропорции при изменении размера' },
];

export function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 24,
          maxWidth: 600,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#1a202c' }}>
            Справка
          </Text>
          <Pressable onPress={onClose}>
            <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Text style={{ fontSize: 20, color: '#6b7280' }}>×</Text>
            </div>
          </Pressable>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1a202c', marginBottom: 12 }}>
            Горячие клавиши
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SHORTCUTS.map((shortcut, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      <kbd
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#1a202c',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        }}
                      >
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>
                  {shortcut.description}
                </Text>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#1a202c', marginBottom: 12 }}>
            Советы
          </Text>
          <ul style={{ paddingLeft: 20, color: '#6b7280', lineHeight: 1.8 }}>
            <li>Двойной клик по блоку для редактирования текста</li>
            <li>Перетаскивайте блоки для изменения позиции</li>
            <li>Используйте маркеры для изменения размера</li>
            <li>Зажмите Shift при изменении размера для сохранения пропорций</li>
            <li>Правый клик открывает контекстное меню</li>
            <li>Все изменения автоматически сохраняются</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

