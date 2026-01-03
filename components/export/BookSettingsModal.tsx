// components/export/BookSettingsModal.tsx
// ✅ УЛУЧШЕНИЕ: Модальное окно настроек фотоальбома

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform } from 'react-native';
import ThemePreview, { type PdfThemeName } from './ThemePreview';
import PresetSelector from './PresetSelector';
import GalleryLayoutSelector from './GalleryLayoutSelector';
import type { BookPreset } from '@/src/types/pdf-presets';
import type { GalleryLayout, CaptionPosition } from '@/src/types/pdf-gallery';
import { METRICS } from '@/constants/layout';
// ✅ ИСПРАВЛЕНИЕ: Picker не используется в веб-версии модального окна
// import { Picker } from '@react-native-picker/picker';

export type ChecklistSection =
  | 'clothing'
  | 'food'
  | 'electronics'
  | 'documents'
  | 'medicine';

// ✅ Экспортируем интерфейс для использования в других компонентах
export interface BookSettings {
  title: string;
  subtitle?: string;
  coverType: 'auto' | 'first-photo' | 'gradient' | 'custom';
  coverImage?: string;
  template: PdfThemeName;
  sortOrder: 'date-desc' | 'date-asc' | 'country' | 'alphabetical';
  includeToc: boolean;
  includeGallery: boolean;
  includeMap: boolean;
  showCoordinatesOnMapPage?: boolean;
  includeChecklists: boolean;
  checklistSections: ChecklistSection[];
  // Настройки галереи
  galleryLayout?: GalleryLayout;
  galleryColumns?: number;
  showCaptions?: boolean;
  captionPosition?: CaptionPosition;
  gallerySpacing?: 'compact' | 'normal' | 'spacious';
}

const DEFAULT_CHECKLIST_SELECTION: ChecklistSection[] = ['clothing', 'food', 'electronics'];

// Цветовые темы и шрифты теперь фиксированы через defaultBookSettings,
// поэтому отдельные массивы опций для UI не нужны.

const CHECKLIST_OPTIONS: Array<{
  value: ChecklistSection;
  label: string;
  items: string[];
}> = [
  { value: 'clothing', label: 'Одежда', items: ['Слои', 'Обувь', 'Дождевик'] },
  { value: 'food', label: 'Еда', items: ['Перекусы', 'Термос', 'Посуда'] },
  { value: 'electronics', label: 'Электроника', items: ['Повербанк', 'Камера', 'Переходники'] },
  { value: 'documents', label: 'Документы', items: ['Паспорт', 'Визы', 'Страховка'] },
  { value: 'medicine', label: 'Аптечка', items: ['Базовая аптечка', 'Пластыри', 'Солнцезащита'] },
];

interface BookSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: BookSettings) => void;
  onPreview?: (settings: BookSettings) => void;
  defaultSettings?: Partial<BookSettings>;
  travelCount: number;
  userName?: string;
  mode?: 'save' | 'preview';
}

const defaultBookSettings: BookSettings = {
  title: 'Мои путешествия',
  subtitle: '',
  coverType: 'auto',
  template: 'minimal',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
  showCoordinatesOnMapPage: true,
  includeChecklists: false,
  checklistSections: DEFAULT_CHECKLIST_SELECTION,
  // Настройки галереи по умолчанию
  galleryLayout: 'grid',
  galleryColumns: 3,
  showCaptions: true,
  captionPosition: 'bottom',
  gallerySpacing: 'normal',
};

const MODAL_COLORS = {
  overlay: 'var(--color-overlay)',
  surface: 'var(--color-surface)',
  surfaceMuted: 'var(--color-surfaceMuted)',
  backgroundSecondary: 'var(--color-backgroundSecondary)',
  backgroundTertiary: 'var(--color-backgroundTertiary)',
  text: 'var(--color-text)',
  textMuted: 'var(--color-textMuted)',
  textSubtle: 'var(--color-textSubtle)',
  border: 'var(--color-border)',
  borderStrong: 'var(--color-borderStrong)',
  primary: 'var(--color-primary)',
  primaryDark: 'var(--color-primaryDark)',
  primaryLight: 'var(--color-primaryLight)',
  primarySoft: 'var(--color-primarySoft)',
  focus: 'var(--color-focus)',
  textOnPrimary: 'var(--color-textOnPrimary)',
  accent: 'var(--color-accent)',
  accentLight: 'var(--color-accentLight)',
};

const MODAL_SHADOWS = {
  light: 'var(--shadow-light)',
  medium: 'var(--shadow-medium)',
  heavy: 'var(--shadow-heavy)',
  modal: 'var(--shadow-modal)',
  soft: 'var(--shadow-soft)',
};


const buildInitialSettings = (
  overrides?: Partial<BookSettings>,
  userName?: string
): BookSettings => {
  const merged: BookSettings = {
    ...defaultBookSettings,
    ...overrides,
  };

  merged.title =
    overrides?.title || (userName ? `Путешествия ${userName}` : defaultBookSettings.title);

  // Флаги includeGallery/includeMap теперь управляются только логикой экспорта,
  // без дополнительных режимов photoMode/mapMode.

  merged.checklistSections =
    overrides?.checklistSections && overrides.checklistSections.length > 0
      ? overrides.checklistSections
      : DEFAULT_CHECKLIST_SELECTION;

  if (typeof merged.includeChecklists === 'undefined') {
    merged.includeChecklists = defaultBookSettings.includeChecklists;
  }

  return merged;
};

export default function BookSettingsModal({
  visible,
  onClose,
  onSave,
  onPreview,
  defaultSettings,
  travelCount,
  userName,
  mode: _mode = 'save',
}: BookSettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<BookSettings>(() =>
    buildInitialSettings(defaultSettings, userName)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();

  useEffect(() => {
    setSettings(buildInitialSettings(defaultSettings, userName));
  }, [defaultSettings, userName]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!visible) return;
    if (typeof document === 'undefined') return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    requestAnimationFrame(() => dialogRef.current?.focus?.());

    return () => document.removeEventListener('keydown', handleKeydown);
  }, [onClose, visible]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const body = document.body;
    const previousOverflow = body.style.overflow;

    if (visible) {
      body.style.overflow = 'hidden';
    }

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [visible]);

  const handlePresetSelect = (preset: BookPreset) => {
    setSettings({
      ...preset.settings,
      title: settings.title, // Сохраняем пользовательский заголовок
      subtitle: settings.subtitle,
    });
    setSelectedPresetId(preset.id);
  };

  const handleThemeSelect = (theme: any) => {
    setSettings({ ...settings, template: theme });
  };

  const checklistSections = settings.checklistSections || [];

  const toggleChecklistSection = (section: ChecklistSection) => {
    setSettings((prev) => {
      const current = prev.checklistSections || [];
      const exists = current.includes(section);
      return {
        ...prev,
        checklistSections: exists
          ? current.filter((item) => item !== section)
          : [...current, section],
      };
    });
  };

  const handleToggleChecklists = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      includeChecklists: enabled,
      checklistSections:
        enabled && (!prev.checklistSections || prev.checklistSections.length === 0)
          ? DEFAULT_CHECKLIST_SELECTION
          : prev.checklistSections,
    }));
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handlePreview = () => {
    if (onPreview) {
      onPreview(settings);
      onClose();
    }
  };

  if (Platform.OS !== 'web') {
    return null; // Только для web
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
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
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: window.innerWidth <= METRICS.breakpoints.tablet ? '16px 12px' : '24px',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          zIndex: 1000,
          transition: 'background-color 0.3s ease',
          isolation: 'isolate',
        }}
        onClick={onClose}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: MODAL_COLORS.overlay,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '22vh',
            backgroundColor: 'rgba(0,0,0,0.01)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 0,
            maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '22vh',
            backgroundColor: 'rgba(0,0,0,0.01)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 0,
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '18vw',
            backgroundColor: 'rgba(0,0,0,0.01)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 0,
            maskImage: 'linear-gradient(to right, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: '18vw',
            backgroundColor: 'rgba(0,0,0,0.01)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 0,
            maskImage: 'linear-gradient(to left, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to left, black 0%, rgba(0,0,0,0.85) 55%, transparent 100%)',
          }}
        />
        <div
          style={{
            backgroundColor: MODAL_COLORS.surface,
            background: MODAL_COLORS.surface as any,
            borderRadius: '20px',
            padding: window.innerWidth <= METRICS.breakpoints.tablet ? '20px' : '28px',
            maxWidth: '800px',
            width: '100%',
            margin: 'auto 0',
            maxHeight: '92vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: MODAL_SHADOWS.modal,
            border: `1px solid ${MODAL_COLORS.borderStrong}`,
            transition: 'all 0.3s ease',
            boxSizing: 'border-box',
            position: 'relative',
            zIndex: 1,
            opacity: 1,
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            filter: 'none',
            mixBlendMode: 'normal',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          ref={dialogRef}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="modal-title"
            style={{
              fontSize: window.innerWidth <= METRICS.breakpoints.tablet ? '20px' : '24px',
              fontWeight: 600,
              margin: '0 0 20px 0',
              color: MODAL_COLORS.text,
              letterSpacing: '-0.3px',
            }}
          >
            Настройки фотоальбома
          </h2>

          <div style={{ marginBottom: '20px', color: MODAL_COLORS.textMuted, fontSize: '14px' }}>
            Выбрано путешествий:&nbsp;
            <span style={{ fontWeight: 600, color: MODAL_COLORS.text }}>{travelCount}</span>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingBottom: '24px',
            }}
          >
            {/* Пресеты настроек */}
            <PresetSelector
              onPresetSelect={handlePresetSelect}
              selectedPresetId={selectedPresetId}
              showCategories={true}
            />

            {/* Разделитель */}
            <div style={{ 
              margin: '24px 0', 
              height: '1px', 
              backgroundColor: MODAL_COLORS.border,
            }} />

            {/* Выбор темы */}
            <ThemePreview
              selectedTheme={settings.template}
              onThemeSelect={handleThemeSelect}
              compact={false}
            />

            {/* Разделитель */}
            <div style={{ 
              margin: '24px 0', 
              height: '1px', 
              backgroundColor: MODAL_COLORS.border,
            }} />

            {/* Настройки галереи */}
            {settings.includeGallery && (
              <>
                <GalleryLayoutSelector
                  selectedLayout={settings.galleryLayout || 'grid'}
                  onLayoutSelect={(layout) => setSettings({ ...settings, galleryLayout: layout })}
                  columns={settings.galleryColumns}
                  onColumnsChange={(cols) => setSettings({ ...settings, galleryColumns: cols })}
                  showCaptions={settings.showCaptions}
                  onShowCaptionsChange={(show) => setSettings({ ...settings, showCaptions: show })}
                  captionPosition={settings.captionPosition}
                  onCaptionPositionChange={(pos) => setSettings({ ...settings, captionPosition: pos })}
                  spacing={settings.gallerySpacing}
                  onSpacingChange={(sp) => setSettings({ ...settings, gallerySpacing: sp })}
                />

                {/* Разделитель */}
                <div style={{ 
                  margin: '24px 0', 
                  height: '1px', 
                  backgroundColor: MODAL_COLORS.border,
                }} />
              </>
            )}

            {/* Кнопка для расширенных настроек */}
            <div 
              style={{ 
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  border: `1.5px solid ${MODAL_COLORS.border}`,
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: MODAL_COLORS.textMuted,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = MODAL_COLORS.primary;
                  e.currentTarget.style.color = MODAL_COLORS.primary;
                  e.currentTarget.style.backgroundColor = MODAL_COLORS.primarySoft;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = MODAL_COLORS.border;
                  e.currentTarget.style.color = MODAL_COLORS.textMuted;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {showAdvanced ? '▲ Скрыть детальные настройки' : '▼ Показать детальные настройки'}
              </button>
            </div>

            {showAdvanced && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    Название книги
                  </label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${MODAL_COLORS.border}`,
                      borderRadius: '12px',
                      fontSize: '15px',
                      minHeight: '44px',
                      backgroundColor: MODAL_COLORS.surface,
                      color: MODAL_COLORS.text,
                      outline: 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                      e.target.style.backgroundColor = MODAL_COLORS.surface;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.border;
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Мои путешествия"
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    Подзаголовок (опционально)
                  </label>
                  <input
                    type="text"
                    value={settings.subtitle || ''}
                    onChange={(e) => setSettings({ ...settings, subtitle: e.target.value || undefined })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${MODAL_COLORS.border}`,
                      borderRadius: '12px',
                      fontSize: '15px',
                      minHeight: '44px',
                      backgroundColor: MODAL_COLORS.surface,
                      color: MODAL_COLORS.text,
                      outline: 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                      e.target.style.backgroundColor = MODAL_COLORS.surface;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.border;
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Воспоминания 2024"
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    Тип обложки
                  </label>
                  <select
                    value={settings.coverType}
                    onChange={(e) => setSettings({ ...settings, coverType: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${MODAL_COLORS.border}`,
                      borderRadius: '12px',
                      fontSize: '15px',
                      minHeight: '44px',
                      backgroundColor: MODAL_COLORS.surface,
                      color: MODAL_COLORS.text,
                      outline: 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                      e.target.style.backgroundColor = MODAL_COLORS.surface;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.border;
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="auto">Автоматическая (лучшее фото)</option>
                    <option value="first-photo">Первое фото первого путешествия</option>
                    <option value="gradient">Градиент</option>
                    <option value="custom">Свое изображение</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.includeToc}
                  onChange={(e) => setSettings({ ...settings, includeToc: e.target.checked })}
                  style={{
                    width: '20px',
                    height: '20px',
                    minWidth: '20px',
                    minHeight: '20px',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontWeight: 500, color: MODAL_COLORS.text, fontSize: '15px' }}>
                  Включить оглавление
                </span>
              </label>
            </div>

            <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '14px', border: `1px solid ${MODAL_COLORS.border}`, backgroundColor: MODAL_COLORS.backgroundSecondary, transition: 'all 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                  Чек-листы путешественника
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: MODAL_COLORS.textMuted, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={settings.includeChecklists}
                    onChange={(e) => handleToggleChecklists(e.target.checked)}
                    style={{
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      minHeight: '20px',
                      accentColor: MODAL_COLORS.primary,
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  />
                  Добавить в PDF
                </label>
              </div>
              <div style={{ fontSize: '12px', color: MODAL_COLORS.textSubtle, marginBottom: settings.includeChecklists ? '12px' : 0 }}>
                Стандартные списки для печати: экипировка, еда, документы, техника и аптечка.
              </div>
              {settings.includeChecklists && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {CHECKLIST_OPTIONS.map((option) => {
                    const selected = checklistSections.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        style={{
                          borderRadius: '12px',
                          border: selected
                            ? `2px solid ${MODAL_COLORS.primary}`
                            : `1px solid ${MODAL_COLORS.border}`,
                          padding: '12px',
                          backgroundColor: selected ? MODAL_COLORS.primarySoft : MODAL_COLORS.surface,
                          cursor: 'pointer',
                          display: 'block',
                          boxShadow: selected ? MODAL_SHADOWS.medium : MODAL_SHADOWS.soft,
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = MODAL_COLORS.borderStrong;
                            e.currentTarget.style.boxShadow = MODAL_SHADOWS.light;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.borderColor = MODAL_COLORS.border;
                            e.currentTarget.style.boxShadow = MODAL_SHADOWS.soft;
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600, color: MODAL_COLORS.text }}>{option.label}</span>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleChecklistSection(option.value)}
                            style={{
                              width: '18px',
                              height: '18px',
                              minWidth: '18px',
                              minHeight: '18px',
                              accentColor: MODAL_COLORS.primary,
                              cursor: 'pointer',
                              borderRadius: '4px',
                            }}
                          />
                        </div>
                        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: MODAL_COLORS.textMuted }}>
                          {option.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              borderTop: `1px solid ${MODAL_COLORS.border}`,
              paddingTop: '16px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '12px 20px',
                border: `1px solid ${MODAL_COLORS.border}`,
                borderRadius: '12px',
                backgroundColor: MODAL_COLORS.surface,
                color: MODAL_COLORS.text,
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                boxShadow: MODAL_SHADOWS.light,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = MODAL_COLORS.primary;
                e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = MODAL_COLORS.border;
                e.target.style.boxShadow = MODAL_SHADOWS.light;
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = MODAL_COLORS.backgroundTertiary;
                target.style.transform = 'translateY(-1px)';
                target.style.boxShadow = MODAL_SHADOWS.medium;
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = MODAL_COLORS.surface;
                target.style.transform = 'translateY(0)';
                target.style.boxShadow = MODAL_SHADOWS.light;
              }}
            >
              Отмена
            </button>
            {onPreview && (
              <button
                onClick={handlePreview}
                style={{
                  padding: '12px 20px',
                  border: `1px solid ${MODAL_COLORS.primary}`,
                  borderRadius: '12px',
                  backgroundColor: MODAL_COLORS.surface,
                  color: MODAL_COLORS.primary,
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                  boxShadow: MODAL_SHADOWS.light,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = MODAL_COLORS.primary;
                  e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = MODAL_COLORS.primary;
                  e.target.style.boxShadow = MODAL_SHADOWS.light;
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = MODAL_COLORS.primaryLight;
                  target.style.transform = 'translateY(-1px)';
                  target.style.boxShadow = MODAL_SHADOWS.medium;
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = MODAL_COLORS.surface;
                  target.style.transform = 'translateY(0)';
                  target.style.boxShadow = MODAL_SHADOWS.light;
                }}
              >
                Превью
              </button>
            )}
            <button
              onClick={handleSave}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderRadius: '12px',
                backgroundColor: MODAL_COLORS.primary,
                color: MODAL_COLORS.textOnPrimary,
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                boxShadow: MODAL_SHADOWS.medium,
              }}
              onFocus={(e) => {
                e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}, ${MODAL_SHADOWS.medium}`;
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = MODAL_SHADOWS.medium;
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = MODAL_COLORS.primaryDark;
                target.style.transform = 'translateY(-1px)';
                target.style.boxShadow = MODAL_SHADOWS.heavy;
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = MODAL_COLORS.primary;
                target.style.transform = 'translateY(0)';
                target.style.boxShadow = MODAL_SHADOWS.medium;
              }}
            >
              Сохранить PDF
            </button>
          </div>
        </div>
      </div>

    </Modal>
  );
}
