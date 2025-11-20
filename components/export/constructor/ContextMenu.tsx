// components/export/constructor/ContextMenu.tsx
// ✅ АРХИТЕКТУРА: Контекстное меню для блоков

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface ContextMenuProps {
  x: number;
  y: number;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  canPaste?: boolean;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  onCopy,
  onPaste,
  onDelete,
  onDuplicate,
  canPaste = false,
  onClose,
}: ContextMenuProps) {
  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 2000,
        minWidth: 150,
        padding: 4,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {onCopy && (
        <Pressable
          onPress={() => {
            onCopy();
            onClose();
          }}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 4,
          }}
          onHoverIn={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
          }}
          onHoverOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Text style={{ fontSize: 14 }}>📋 Копировать (Ctrl+C)</Text>
        </Pressable>
      )}
      {onPaste && canPaste && (
        <Pressable
          onPress={() => {
            onPaste();
            onClose();
          }}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 4,
          }}
          onHoverIn={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
          }}
          onHoverOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Text style={{ fontSize: 14 }}>📄 Вставить (Ctrl+V)</Text>
        </Pressable>
      )}
      {onDuplicate && (
        <Pressable
          onPress={() => {
            onDuplicate();
            onClose();
          }}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 4,
          }}
          onHoverIn={(e) => {
            e.currentTarget.style.backgroundColor = '#f0f0f0';
          }}
          onHoverOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Text style={{ fontSize: 14 }}>📑 Дублировать</Text>
        </Pressable>
      )}
      {onDelete && (
        <>
          <div style={{ height: 1, backgroundColor: '#e5e7eb', margin: '4px 0' }} />
          <Pressable
            onPress={() => {
              onDelete();
              onClose();
            }}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: 4,
            }}
            onHoverIn={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
            }}
            onHoverOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Text style={{ fontSize: 14, color: '#dc2626' }}>🗑️ Удалить (Delete)</Text>
          </Pressable>
        </>
      )}
    </div>
  );
}

