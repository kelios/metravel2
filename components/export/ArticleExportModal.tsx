// components/export/ArticleExportModal.tsx
// ✅ АРХИТЕКТУРА: Модальное окно настроек экспорта статьи в PDF

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import type { ArticleExportSettings } from '@/src/services/pdf-export/generators/ArticlePdfGenerator';
import PdfConstructor from './PdfConstructor';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ArticleExportModalProps {
  visible: boolean;
  onClose: () => void;
  onExport: (settings: ArticleExportSettings) => void;
  defaultSettings?: Partial<ArticleExportSettings>;
  travelData?: any; // Данные статьи для конструктора
}

const defaultSettings: ArticleExportSettings = {
  theme: 'light',
  format: 'A4',
  includeToc: true,
  includeMap: true,
  includeRecommendations: true,
  language: 'ru',
};

export default function ArticleExportModal({
  visible,
  onClose,
  onExport,
  defaultSettings: userDefaults,
  travelData,
}: ArticleExportModalProps) {
  const [settings, setSettings] = useState<ArticleExportSettings>({
    ...defaultSettings,
    ...userDefaults,
  });
  const [showConstructor, setShowConstructor] = useState(false);

  const handleExport = () => {
    onExport(settings);
    onClose();
  };

  const handleOpenConstructor = () => {
    setShowConstructor(true);
  };

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Настройки экспорта PDF</Text>
            <Pressable 
              onPress={onClose} 
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            {/* Выбор темы */}
            <View style={styles.section}>
              <Text style={styles.label}>Стиль оформления</Text>
              <View style={styles.optionsRow}>
                {(['simple', 'light', 'dark', 'magazine'] as const).map((theme) => (
                  <Pressable
                    key={theme}
                    onPress={() => setSettings({ ...settings, theme })}
                    style={[
                      styles.optionButton,
                      settings.theme === theme && styles.optionButtonActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Выбрать стиль: ${theme === 'simple' ? 'Простой' : theme === 'light' ? 'Светлый' : theme === 'dark' ? 'Темный' : 'Журнальный'}`}
                    accessibilityState={{ selected: settings.theme === theme }}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        settings.theme === theme && styles.optionButtonTextActive,
                      ]}
                    >
                      {theme === 'simple' ? 'Простой' : theme === 'light' ? 'Светлый' : theme === 'dark' ? 'Темный' : 'Журнальный'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Выбор формата */}
            <View style={styles.section}>
              <Text style={styles.label}>Формат страницы</Text>
              <View style={styles.optionsRow}>
                {(['A4', 'Letter', 'A5'] as const).map((format) => (
                  <Pressable
                    key={format}
                    onPress={() => setSettings({ ...settings, format })}
                    style={[
                      styles.optionButton,
                      settings.format === format && styles.optionButtonActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Выбрать формат: ${format}`}
                    accessibilityState={{ selected: settings.format === format }}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        settings.format === format && styles.optionButtonTextActive,
                      ]}
                    >
                      {format}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Опции */}
            <View style={styles.section}>
              <Text style={styles.label}>Дополнительные опции</Text>
              <View style={styles.checkboxContainer}>
                <Pressable
                  onPress={() => setSettings({ ...settings, includeToc: !settings.includeToc })}
                  style={styles.checkboxRow}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Добавить оглавление"
                  accessibilityState={{ checked: settings.includeToc }}
                >
                  <View style={[styles.checkbox, settings.includeToc && styles.checkboxChecked]}>
                    {settings.includeToc && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Добавить оглавление</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSettings({ ...settings, includeMap: !settings.includeMap })}
                  style={styles.checkboxRow}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Включить карту маршрута"
                  accessibilityState={{ checked: settings.includeMap }}
                >
                  <View style={[styles.checkbox, settings.includeMap && styles.checkboxChecked]}>
                    {settings.includeMap && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Включить карту маршрута</Text>
                </Pressable>

                <Pressable
                  onPress={() => setSettings({ ...settings, includeRecommendations: !settings.includeRecommendations })}
                  style={styles.checkboxRow}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Включить блок рекомендаций"
                  accessibilityState={{ checked: settings.includeRecommendations }}
                >
                  <View style={[styles.checkbox, settings.includeRecommendations && styles.checkboxChecked]}>
                    {settings.includeRecommendations && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Включить блок рекомендаций</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable 
              onPress={handleOpenConstructor} 
              style={styles.constructorButton}
              accessibilityRole="button"
              accessibilityLabel="Открыть конструктор"
            >
              <Text style={styles.constructorButtonText}>Открыть конструктор</Text>
            </Pressable>
            <Pressable 
              onPress={onClose} 
              style={styles.cancelButton}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </Pressable>
            <Pressable 
              onPress={handleExport} 
              style={styles.exportButton}
              accessibilityRole="button"
              accessibilityLabel="Экспортировать PDF"
            >
              <Text style={styles.exportButtonText}>Экспортировать</Text>
            </Pressable>
          </View>
        </div>
      </div>

      {/* Конструктор PDF */}
      {showConstructor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2000,
            backgroundColor: '#fff',
          }}
        >
          <PdfConstructor
            travelData={travelData}
            onClose={() => setShowConstructor(false)}
            onExport={(blob, filename) => {
              // Автоматически скачиваем файл
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              setShowConstructor(false);
              onClose();
            }}
          />
        </div>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a202c',
  },
  closeButton: {
    width: 40, // ✅ ИСПРАВЛЕНИЕ: Увеличена ширина для touch-целей
    height: 40, // ✅ ИСПРАВЛЕНИЕ: Увеличена высота для touch-целей
    minWidth: 40,
    minHeight: 40,
    borderRadius: DESIGN_TOKENS.radii.pill, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    outline: 'none',
    // @ts-ignore
    ':hover': {
      backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    },
    // @ts-ignore
    ':focus': {
      outlineWidth: 2,
      outlineColor: DESIGN_TOKENS.colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
    lineHeight: 24,
  },
  content: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
    borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    minHeight: 40, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    outline: 'none',
    // @ts-ignore
    ':hover': {
      backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    },
    // @ts-ignore
    ':focus': {
      outlineWidth: 2,
      outlineColor: DESIGN_TOKENS.colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  optionButtonActive: {
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
  },
  optionButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  checkboxContainer: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    // @ts-ignore
    ':hover': {
      backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    },
    // @ts-ignore
    ':focus': {
      outlineWidth: 2,
      outlineColor: DESIGN_TOKENS.colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  checkbox: {
    width: 24, // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для touch-целей
    height: 24, // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для touch-целей
    minWidth: 24,
    minHeight: 24,
    borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только фон
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DESIGN_TOKENS.colors.surface, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
  },
  checkboxChecked: {
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  constructorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
    borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.success, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    outline: 'none',
    // @ts-ignore
    ':hover': {
      backgroundColor: '#16a34a', // Темнее success для hover
      transform: 'translateY(-1px)',
    },
    // @ts-ignore
    ':focus': {
      outlineWidth: 2,
      outlineColor: DESIGN_TOKENS.colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  constructorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
    borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    outline: 'none',
    // @ts-ignore
    ':hover': {
      backgroundColor: DESIGN_TOKENS.colors.primarySoft,
    },
    // @ts-ignore
    ':focus': {
      outlineWidth: 2,
      outlineColor: DESIGN_TOKENS.colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  exportButton: {
    paddingHorizontal: 20,
    paddingVertical: 12, // ✅ ИСПРАВЛЕНИЕ: Увеличен padding
    borderRadius: DESIGN_TOKENS.radii.sm, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    outline: 'none',
    // @ts-ignore
    ':hover': {
      backgroundColor: '#3a7a7a', // Темнее primary для hover
      transform: 'translateY(-1px)',
    },
    // @ts-ignore
    ':focus': {
      outlineWidth: 2,
      outlineColor: DESIGN_TOKENS.colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 2,
    },
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

