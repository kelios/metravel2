// components/KeyboardShortcutsHelp.tsx
// ✅ УЛУЧШЕНИЕ: Компонент для отображения справки по keyboard shortcuts

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  shortcuts?: Array<{ key: string; description: string; combination: string }>;
}

const palette = DESIGN_TOKENS.colors;

export default function KeyboardShortcutsHelp({ shortcuts = [] }: KeyboardShortcutsHelpProps) {
  const [isVisible, setIsVisible] = useState(false);

  // ✅ УЛУЧШЕНИЕ: Shortcut для открытия справки (Ctrl+?)
  useKeyboardShortcuts([
    {
      key: '?',
      ctrlKey: true,
      action: () => setIsVisible(true),
      description: 'Показать справку по shortcuts',
    },
  ]);

  const defaultShortcuts = [
    { key: 'Ctrl+K', description: 'Открыть поиск', combination: 'Ctrl+K' },
    { key: 'Ctrl+S', description: 'Сохранить', combination: 'Ctrl+S' },
    { key: 'Ctrl+N', description: 'Создать новое', combination: 'Ctrl+N' },
    { key: 'Esc', description: 'Закрыть модальное окно', combination: 'Esc' },
    { key: 'Alt+←', description: 'Назад', combination: 'Alt+←' },
    { key: 'Alt+→', description: 'Вперед', combination: 'Alt+→' },
  ];

  const allShortcuts = [...defaultShortcuts, ...shortcuts];

  if (Platform.OS !== 'web') return null;

  return (
    <>
      <Pressable
        style={styles.helpButton}
        onPress={() => setIsVisible(true)}
        accessibilityLabel="Показать справку по keyboard shortcuts"
        {...Platform.select({
          web: {
            cursor: 'pointer',
            // @ts-ignore
            ':hover': {
              opacity: 0.8,
            },
          },
        })}
      >
        <Feather name="help-circle" size={20} color={palette.textMuted} />
      </Pressable>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsVisible(false)}
          accessibilityLabel="Закрыть справку"
        >
          <View
            style={styles.modalContent}
            {...Platform.select({
              web: {
                // @ts-ignore
                role: 'dialog',
                'aria-label': 'Справка по keyboard shortcuts',
                'aria-modal': true,
              },
            })}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Keyboard Shortcuts</Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setIsVisible(false)}
                accessibilityLabel="Закрыть"
              >
                <Feather name="x" size={24} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.content}>
              {allShortcuts.map((shortcut, index) => (
                <View key={index} style={styles.shortcutRow}>
                  <View style={styles.shortcutKey}>
                    <Text style={styles.shortcutKeyText}>{shortcut.combination || shortcut.key}</Text>
                  </View>
                  <Text style={styles.shortcutDescription}>{shortcut.description}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Нажмите <Text style={styles.footerKey}>Ctrl+?</Text> в любое время для открытия этой справки
              </Text>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  helpButton: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
      },
    }),
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        // @ts-ignore
        ':hover': {
          backgroundColor: palette.primarySoft,
        },
      },
    }),
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  shortcutKey: {
    minWidth: 120,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: palette.primarySoft,
    borderRadius: 6,
    marginRight: 16,
  },
  shortcutKeyText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.primary,
    fontFamily: Platform.select({
      web: 'monospace',
      default: undefined,
    }),
  },
  shortcutDescription: {
    flex: 1,
    fontSize: 14,
    color: palette.text,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.primarySoft,
  },
  footerText: {
    fontSize: 12,
    color: palette.textMuted,
    textAlign: 'center',
  },
  footerKey: {
    fontFamily: Platform.select({
      web: 'monospace',
      default: undefined,
    }),
    fontWeight: '600',
    color: palette.primary,
  },
});

