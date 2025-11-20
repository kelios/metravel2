// components/export/constructor/Toolbar.tsx
// ✅ АРХИТЕКТУРА: Улучшенный тулбар конструктора

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Tooltip } from './Tooltip';

interface ToolbarProps {
  onAddBlock: () => void;
  onAddPage: () => void;
  onPageSettings: () => void;
  onThemeChange: (themeId: string) => void;
  currentThemeId: string;
  themes: Array<{ id: string; name: string }>;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExportLayout: () => void;
  onImportLayout: () => void;
  onExport: () => void;
  isExporting: boolean;
  exportProgress: number;
  onHelp?: () => void;
  onClose?: () => void;
}

export function Toolbar({
  onAddBlock,
  onAddPage,
  onPageSettings,
  onThemeChange,
  currentThemeId,
  themes,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportLayout,
  onImportLayout,
  onExport,
  isExporting,
  exportProgress,
  onHelp,
  onClose,
}: ToolbarProps) {
  return (
    <div style={styles.toolbar}>
      {/* Левая группа: Основные действия */}
      <div style={styles.toolbarGroup}>
        <Tooltip text="Добавить блок (B)">
            <Pressable onPress={onAddBlock}>
              <div style={styles.primaryButton}>
                <span style={styles.buttonIcon}>➕</span>
                <Text style={styles.buttonText}>Блок</Text>
              </div>
            </Pressable>
        </Tooltip>
        <Tooltip text="Добавить страницу">
            <Pressable onPress={onAddPage}>
              <div style={styles.button}>
                <span style={styles.buttonIcon}>📄</span>
                <Text style={styles.buttonText}>Страница</Text>
              </div>
            </Pressable>
        </Tooltip>
        <div style={styles.divider} />
        <Tooltip text="Параметры страницы (формат, ориентация)">
            <Pressable onPress={onPageSettings}>
              <div style={styles.button}>
                <span style={styles.buttonIcon}>⚙️</span>
                <Text style={styles.buttonText}>Формат</Text>
              </div>
            </Pressable>
        </Tooltip>
        <div style={styles.themeSelector}>
          <select
            value={currentThemeId}
            onChange={(e) => onThemeChange(e.target.value)}
            style={styles.select}
          >
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Правая группа: История и экспорт */}
      <div style={styles.toolbarGroup}>
        <Tooltip text={`Отменить (Ctrl+Z)${canUndo ? '' : ' - недоступно'}`}>
            <Pressable
              onPress={onUndo}
              disabled={!canUndo}
            >
              <div style={{ ...styles.iconButton, ...(!canUndo ? { opacity: 0.4, cursor: 'not-allowed' } : {}) } as React.CSSProperties}>
                <span style={styles.iconButtonIcon}>↶</span>
              </div>
            </Pressable>
        </Tooltip>
        <Tooltip text={`Повторить (Ctrl+Shift+Z)${canRedo ? '' : ' - недоступно'}`}>
            <Pressable
              onPress={onRedo}
              disabled={!canRedo}
            >
              <div style={{ ...styles.iconButton, ...(!canRedo ? { opacity: 0.4, cursor: 'not-allowed' } : {}) } as React.CSSProperties}>
                <span style={styles.iconButtonIcon}>↷</span>
              </div>
            </Pressable>
        </Tooltip>
        <div style={styles.divider} />
        <Tooltip text="Сохранить макет в файл">
            <Pressable onPress={onExportLayout}>
              <div style={styles.iconButton}>
                <span style={styles.iconButtonIcon}>💾</span>
              </div>
            </Pressable>
        </Tooltip>
        <Tooltip text="Загрузить макет из файла">
            <Pressable onPress={onImportLayout}>
              <div style={styles.iconButton}>
                <span style={styles.iconButtonIcon}>📂</span>
              </div>
            </Pressable>
        </Tooltip>
        <div style={styles.divider} />
        <Pressable
          onPress={onExport}
          disabled={isExporting}
        >
          <div style={{ ...styles.exportButton, ...(isExporting ? { opacity: 0.6, cursor: 'not-allowed' } : {}) } as React.CSSProperties}>
            <span style={styles.exportButtonIcon}>📥</span>
            <Text style={styles.exportButtonText}>
              {isExporting ? `Экспорт... ${exportProgress}%` : 'Экспорт PDF'}
            </Text>
          </div>
        </Pressable>
        {onHelp && (
          <Tooltip text="Справка и горячие клавиши">
            <Pressable onPress={onHelp}>
              <div style={styles.iconButton}>
                <span style={styles.iconButtonIcon}>❓</span>
              </div>
            </Pressable>
          </Tooltip>
        )}
        {onClose && (
          <Tooltip text="Закрыть конструктор">
            <Pressable onPress={onClose}>
              <div style={styles.closeButton}>
                <span style={styles.closeButtonIcon}>×</span>
              </div>
            </Pressable>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: '8px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    zIndex: 100,
  },
  toolbarGroup: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: 4,
    alignItems: 'center' as const,
  },
  primaryButton: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ff9f5a',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  button: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonIcon: {
    fontSize: 16,
    lineHeight: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1f2937',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  themeSelector: {
    marginLeft: 4,
  },
  select: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    fontSize: 14,
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    outline: 'none',
  },
  iconButton: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  iconButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed' as const,
  },
  iconButtonIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  exportButton: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#059669',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  exportButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed' as const,
  },
  exportButtonIcon: {
    fontSize: 16,
    lineHeight: 1,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  closeButtonIcon: {
    fontSize: 20,
    lineHeight: 1,
    color: '#6b7280',
  },
} as const;

