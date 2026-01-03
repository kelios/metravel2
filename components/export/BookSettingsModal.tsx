// components/export/BookSettingsModal.tsx
// ✅ УЛУЧШЕНИЕ: Модальное окно настроек фотоальбома

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ThemePreview, { type PdfThemeName } from './ThemePreview';
import PresetSelector from './PresetSelector';
import GalleryLayoutSelector from './GalleryLayoutSelector';
import type { BookPreset } from '@/src/types/pdf-presets';
import type { GalleryLayout, CaptionPosition } from '@/src/types/pdf-gallery';
import { METRICS } from '@/constants/layout';
import { useFocusTrap } from '@/hooks/useFocusTrap';
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
  overlay: 'var(--color-overlay, rgba(31, 31, 31, 0.4))',
  surface: 'var(--color-surface, #ffffff)',
  surfaceMuted: 'var(--color-surfaceMuted, rgba(255, 255, 255, 0.75))',
  backgroundSecondary: 'var(--color-backgroundSecondary, #f9f8f6)',
  backgroundTertiary: 'var(--color-backgroundTertiary, #f5f4f2)',
  text: 'var(--color-text, #3a3a3a)',
  textMuted: 'var(--color-textMuted, #6a6a6a)',
  textSubtle: 'var(--color-textSubtle, #8a8a8a)',
  border: 'var(--color-border, rgba(58, 58, 58, 0.06))',
  borderStrong: 'var(--color-borderStrong, rgba(58, 58, 58, 0.1))',
  primary: 'var(--color-primary, #7a9d8f)',
  primaryDark: 'var(--color-primaryDark, #6a8d7f)',
  primaryLight: 'var(--color-primaryLight, #f0f5f3)',
  primarySoft: 'var(--color-primarySoft, rgba(122, 157, 143, 0.06))',
  focus: 'var(--color-focus, rgba(93, 140, 124, 0.35))',
  textOnPrimary: 'var(--color-textOnPrimary, #111827)',
  accent: 'var(--color-accent, #8a9aa8)',
  accentLight: 'var(--color-accentLight, #f2f4f6)',
  error: 'var(--color-error, #b89090)',
  errorSoft: 'var(--color-errorSoft, rgba(184, 144, 144, 0.08))',
  errorDark: 'var(--color-errorDark, #a88080)',
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
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  const [settings, setSettings] = useState<BookSettings>(() =>
    buildInitialSettings(defaultSettings, userName)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // ✅ УЛУЧШЕНИЕ: Focus trap для доступности
  useFocusTrap(dialogRef, {
    enabled: visible && Platform.OS === 'web',
    initialFocus: firstFocusableRef,
  });

  useEffect(() => {
    // ✅ УЛУЧШЕНИЕ: Загружаем сохраненные настройки из localStorage
    let savedSettings: Partial<BookSettings> | undefined;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined' && !defaultSettings) {
      try {
        const stored = localStorage.getItem('metravel_pdf_settings');
        if (stored) {
          savedSettings = JSON.parse(stored) as Partial<BookSettings>;
        }
      } catch (e) {
        console.warn('Failed to load settings from localStorage:', e);
      }
    }

    setSettings(buildInitialSettings(savedSettings || defaultSettings, userName));
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  }, [defaultSettings, userName]);

  // ✅ УЛУЧШЕНИЕ: Валидация настроек
  useEffect(() => {
    const errors: string[] = [];

    if (!settings.title || settings.title.trim().length === 0) {
      errors.push('Укажите название книги');
    }

    if (settings.title && settings.title.length > 100) {
      errors.push('Название книги не должно превышать 100 символов');
    }

    if (settings.subtitle && settings.subtitle.length > 150) {
      errors.push('Подзаголовок не должен превышать 150 символов');
    }

    if (settings.includeChecklists && settings.checklistSections.length === 0) {
      errors.push('Выберите хотя бы один раздел чек-листа или отключите чек-листы');
    }

    setValidationErrors(errors);
  }, [settings]);

  // ✅ УЛУЧШЕНИЕ: Обработчик закрытия с предупреждением о несохраненных изменениях
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  const handleConfirmClose = useCallback(() => {
    setShowUnsavedWarning(false);
    setHasUnsavedChanges(false);
    onClose();
  }, [onClose]);

  // ✅ УЛУЧШЕНИЕ: Обработка клавиши Escape
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!visible) return;
    if (typeof document === 'undefined') return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    requestAnimationFrame(() => dialogRef.current?.focus?.());

    return () => document.removeEventListener('keydown', handleKeydown);
  }, [visible, handleClose]);

  // ✅ УЛУЧШЕНИЕ: Блокировка скролла body при открытом модале
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

  const handlePresetSelect = useCallback((preset: BookPreset) => {
    setSettings({
      ...preset.settings,
      title: settings.title, // Сохраняем пользовательский заголовок
      subtitle: settings.subtitle,
    });
    setSelectedPresetId(preset.id);
    setHasUnsavedChanges(true);
  }, [settings.title, settings.subtitle]);

  const handleThemeSelect = useCallback((theme: PdfThemeName) => {
    setSettings((prev) => ({ ...prev, template: theme }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSettingsChange = useCallback((updates: Partial<BookSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

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

  const handleToggleChecklists = useCallback((enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      includeChecklists: enabled,
      checklistSections:
        enabled && (!prev.checklistSections || prev.checklistSections.length === 0)
          ? DEFAULT_CHECKLIST_SELECTION
          : prev.checklistSections,
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (validationErrors.length > 0) {
      // Ошибки уже показаны в UI, просто не даем сохранить
      return;
    }

    setIsSaving(true);
    try {
      // Сохраняем в localStorage для будущего использования
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('metravel_pdf_settings', JSON.stringify(settings));
        } catch (e) {
          console.warn('Failed to save settings to localStorage:', e);
        }
      }

      await onSave(settings);
      setHasUnsavedChanges(false);
      onClose();
    } catch (error) {
      console.error('Failed to save PDF settings:', error);
      // TODO: Показать toast уведомление об ошибке
    } finally {
      setIsSaving(false);
    }
  }, [settings, validationErrors, onSave, onClose]);

  const handlePreview = useCallback(async () => {
    if (!onPreview) return;

    if (validationErrors.length > 0) {
      // Ошибки уже показаны в UI, просто не даем создать превью
      return;
    }

    setIsSaving(true);
    try {
      await onPreview(settings);
      onClose();
    } catch (error) {
      console.error('Failed to generate preview:', error);
      // TODO: Показать toast уведомление об ошибке
    } finally {
      setIsSaving(false);
    }
  }, [settings, validationErrors, onPreview, onClose]);

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
          alignItems: 'center',
          justifyContent: 'center',
          padding: window.innerWidth <= METRICS.breakpoints.tablet ? '16px 12px' : '24px',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          zIndex: 1000,
          transition: 'background-color 0.3s ease',
          isolation: 'isolate',
        }}
        onClick={handleClose}
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
            backgroundColor: MODAL_COLORS.surface,
            background: MODAL_COLORS.surface as any,
            borderRadius: '20px',
            padding: window.innerWidth <= METRICS.breakpoints.tablet ? '20px' : '28px',
            maxWidth: '800px',
            width: '100%',
            margin: '0 auto',
            maxHeight:
              window.innerWidth <= METRICS.breakpoints.tablet
                ? 'calc(100vh - 32px)'
                : 'calc(100vh - 48px)',
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
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span>Настройки фотоальбома</span>
            {hasUnsavedChanges && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: MODAL_COLORS.accentLight,
                  color: MODAL_COLORS.accent,
                }}
                title="У вас есть несохраненные изменения"
              >
                • Не сохранено
              </span>
            )}
          </h2>

          {/* ✅ УЛУЧШЕНИЕ: Показываем ошибки валидации */}
          {validationErrors.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: MODAL_COLORS.errorSoft,
                border: `1px solid ${MODAL_COLORS.error}`,
                marginBottom: '20px',
              }}
              role="alert"
              aria-live="polite"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: MODAL_COLORS.errorDark, marginBottom: '6px' }}>
                <MaterialIcons name="warning" size={16} color={MODAL_COLORS.errorDark as any} />
                <span>Исправьте ошибки:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: MODAL_COLORS.errorDark }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '12px',
            backgroundColor: MODAL_COLORS.primarySoft,
            border: `1px solid ${MODAL_COLORS.primary}20`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
              <MaterialIcons name="photo-album" size={20} color={MODAL_COLORS.primary as any} />
            </span>
            <div>
              <div style={{ color: MODAL_COLORS.text, fontSize: '14px', fontWeight: 500 }}>
                Выбрано путешествий:&nbsp;
                <span style={{ fontWeight: 700, color: MODAL_COLORS.primary }}>{travelCount}</span>
              </div>
              <div style={{ fontSize: '12px', color: MODAL_COLORS.textMuted, marginTop: '2px' }}>
                {travelCount === 1
                  ? 'Будет создана книга с одним путешествием'
                  : `Будет создана книга с ${travelCount} путешествиями`}
              </div>
            </div>
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
                  onLayoutSelect={(layout) => handleSettingsChange({ galleryLayout: layout })}
                  columns={settings.galleryColumns}
                  onColumnsChange={(cols) => handleSettingsChange({ galleryColumns: cols })}
                  showCaptions={settings.showCaptions}
                  onShowCaptionsChange={(show) => handleSettingsChange({ showCaptions: show })}
                  captionPosition={settings.captionPosition}
                  onCaptionPositionChange={(pos) => handleSettingsChange({ captionPosition: pos })}
                  spacing={settings.gallerySpacing}
                  onSpacingChange={(sp) => handleSettingsChange({ gallerySpacing: sp })}
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
                title={showAdvanced ? 'Скрыть настройки обложки и заголовков' : 'Показать настройки обложки и заголовков'}
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
                    <span style={{ color: MODAL_COLORS.error, marginLeft: '4px' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => handleSettingsChange({ title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${validationErrors.some(e => e.includes('название')) ? MODAL_COLORS.error : MODAL_COLORS.border}`,
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
                      e.target.style.borderColor = validationErrors.some(err => err.includes('название')) ? (MODAL_COLORS.error as any) : (MODAL_COLORS.border as any);
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Мои путешествия"
                    maxLength={100}
                    aria-required="true"
                    aria-invalid={validationErrors.some(e => e.includes('название'))}
                  />
                  <div style={{ fontSize: '11px', color: MODAL_COLORS.textMuted, marginTop: '4px', textAlign: 'right' }}>
                    {settings.title.length}/100 символов
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    Подзаголовок (опционально)
                  </label>
                  <input
                    type="text"
                    value={settings.subtitle || ''}
                    onChange={(e) => handleSettingsChange({ subtitle: e.target.value || undefined })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${validationErrors.some(e => e.includes('Подзаголовок')) ? MODAL_COLORS.error : MODAL_COLORS.border}`,
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
                      e.target.style.borderColor = validationErrors.some(err => err.includes('Подзаголовок')) ? (MODAL_COLORS.error as any) : (MODAL_COLORS.border as any);
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="Воспоминания 2024"
                    maxLength={150}
                    aria-invalid={validationErrors.some(e => e.includes('Подзаголовок'))}
                  />
                  <div style={{ fontSize: '11px', color: MODAL_COLORS.textMuted, marginTop: '4px', textAlign: 'right' }}>
                    {(settings.subtitle || '').length}/150 символов
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    Тип обложки
                  </label>
                  <select
                    value={settings.coverType}
                    onChange={(e) => handleSettingsChange({ coverType: e.target.value as any })}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '12px', transition: 'background-color 0.2s', backgroundColor: settings.includeToc ? MODAL_COLORS.primarySoft : 'transparent' }}>
                <input
                  type="checkbox"
                  checked={settings.includeToc}
                  onChange={(e) => handleSettingsChange({ includeToc: e.target.checked })}
                  style={{
                    width: '20px',
                    height: '20px',
                    minWidth: '20px',
                    minHeight: '20px',
                    cursor: 'pointer',
                    accentColor: MODAL_COLORS.primary,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: MODAL_COLORS.text, fontSize: '15px' }}>
                    Включить оглавление
                  </div>
                  <div style={{ fontSize: '12px', color: MODAL_COLORS.textMuted, marginTop: '2px' }}>
                    С миниатюрами и номерами страниц
                  </div>
                </div>
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
              ref={firstFocusableRef}
              onClick={handleClose}
              disabled={isSaving}
              style={{
                padding: '12px 20px',
                border: `1px solid ${MODAL_COLORS.border}`,
                borderRadius: '12px',
                backgroundColor: MODAL_COLORS.surface,
                color: MODAL_COLORS.text,
                fontSize: '15px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                boxShadow: MODAL_SHADOWS.light,
                opacity: isSaving ? 0.5 : 1,
              }}
              onFocus={(e) => {
                if (!isSaving) {
                  e.target.style.borderColor = MODAL_COLORS.primary;
                  e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = MODAL_COLORS.border;
                e.target.style.boxShadow = MODAL_SHADOWS.light;
              }}
              onMouseEnter={(e) => {
                if (!isSaving) {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = MODAL_COLORS.backgroundTertiary;
                  target.style.transform = 'translateY(-1px)';
                  target.style.boxShadow = MODAL_SHADOWS.medium;
                }
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
                disabled={isSaving || validationErrors.length > 0}
                style={{
                  padding: '12px 20px',
                  border: `1px solid ${MODAL_COLORS.primary}`,
                  borderRadius: '12px',
                  backgroundColor: MODAL_COLORS.surface,
                  color: MODAL_COLORS.primary,
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: (isSaving || validationErrors.length > 0) ? 'not-allowed' : 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                  boxShadow: MODAL_SHADOWS.light,
                  opacity: (isSaving || validationErrors.length > 0) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onFocus={(e) => {
                  if (!isSaving && validationErrors.length === 0) {
                    e.target.style.borderColor = MODAL_COLORS.primary;
                    e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                  }
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = MODAL_COLORS.primary;
                  e.target.style.boxShadow = MODAL_SHADOWS.light;
                }}
                onMouseEnter={(e) => {
                  if (!isSaving && validationErrors.length === 0) {
                    const target = e.target as HTMLButtonElement;
                    target.style.backgroundColor = MODAL_COLORS.primaryLight;
                    target.style.transform = 'translateY(-1px)';
                    target.style.boxShadow = MODAL_SHADOWS.medium;
                  }
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = MODAL_COLORS.surface;
                  target.style.transform = 'translateY(0)';
                  target.style.boxShadow = MODAL_SHADOWS.light;
                }}
                aria-label="Предварительный просмотр PDF"
              >
                {isSaving ? '⏳' : '👁️'} Превью
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || validationErrors.length > 0}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderRadius: '12px',
                backgroundColor: (isSaving || validationErrors.length > 0) ? MODAL_COLORS.borderStrong : MODAL_COLORS.primary,
                color: MODAL_COLORS.textOnPrimary,
                fontSize: '15px',
                fontWeight: 600,
                cursor: (isSaving || validationErrors.length > 0) ? 'not-allowed' : 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                boxShadow: MODAL_SHADOWS.medium,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onFocus={(e) => {
                if (!isSaving && validationErrors.length === 0) {
                  e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}, ${MODAL_SHADOWS.medium}`;
                }
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = MODAL_SHADOWS.medium;
              }}
              onMouseEnter={(e) => {
                if (!isSaving && validationErrors.length === 0) {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = MODAL_COLORS.primaryDark;
                  target.style.transform = 'translateY(-1px)';
                  target.style.boxShadow = MODAL_SHADOWS.heavy;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSaving && validationErrors.length === 0) {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = MODAL_COLORS.primary;
                  target.style.transform = 'translateY(0)';
                  target.style.boxShadow = MODAL_SHADOWS.medium;
                }
              }}
              aria-label="Сохранить и создать PDF"
            >
              {isSaving ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    animation: 'spin 1s linear infinite',
                  }}>⏳</span>
                  <style>{`
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  `}</style>
                  Создание...
                </>
              ) : (
                <>📄 Сохранить PDF</>
              )}
            </button>
          </div>
        </div>
      </div>

    </Modal>
  );
}
