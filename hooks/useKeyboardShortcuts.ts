// hooks/useKeyboardShortcuts.ts
// ✅ УЛУЧШЕНИЕ: Хук для глобальных keyboard shortcuts

import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description?: string;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (Platform.OS !== 'web') return;

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const shiftMatches = shortcut.shiftKey !== undefined 
          ? (shortcut.shiftKey ? event.shiftKey : !event.shiftKey)
          : true;
        const altMatches = shortcut.altKey !== undefined
          ? (shortcut.altKey ? event.altKey : !event.altKey)
          : true;
        const metaMatches = shortcut.metaKey !== undefined
          ? (shortcut.metaKey ? event.metaKey : !event.metaKey)
          : true;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown]);
}

// ✅ УЛУЧШЕНИЕ: Предустановленные shortcuts для навигации
export const COMMON_SHORTCUTS = {
  SEARCH: { key: 'k', ctrlKey: true, description: 'Открыть поиск' },
  ESCAPE: { key: 'Escape', description: 'Закрыть модальное окно' },
  SAVE: { key: 's', ctrlKey: true, description: 'Сохранить' },
  NEW: { key: 'n', ctrlKey: true, description: 'Создать новое' },
  DELETE: { key: 'Delete', description: 'Удалить' },
  BACK: { key: 'ArrowLeft', altKey: true, description: 'Назад' },
  FORWARD: { key: 'ArrowRight', altKey: true, description: 'Вперед' },
};

