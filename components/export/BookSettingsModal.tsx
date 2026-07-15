// components/export/BookSettingsModal.tsx
// ✅ УЛУЧШЕНИЕ: Модальное окно настроек фотоальбома

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import ThemePreview, { type PdfThemeName } from './ThemePreview';
import PresetSelector from './PresetSelector';
import GalleryLayoutSelector from './GalleryLayoutSelector';
import type { BookPreset } from '@/types/pdf-presets';
import { METRICS } from '@/constants/layout';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTheme } from '@/hooks/useTheme';
import { usePdfPremium } from '@/hooks/usePdfPremium';
import { showToast } from '@/utils/toast';
import type { BookSettings, ChecklistSection } from './BookSettingsModal.types';
import {
  gallerySettingNeedsPremium,
  isPremiumCoverType,
} from './BookSettingsModal.premium';
import { DEFAULT_CHECKLIST_SELECTION } from './BookSettingsModal.constants';
import {
  buildInitialSettings,
  buildModalColors,
  resolveThemed,
} from './BookSettingsModal.helpers';
import { ChecklistFieldset, ModalFooter } from './BookSettingsModal.parts';
import { translate as i18nT } from '@/i18n'

// ✅ ИСПРАВЛЕНИЕ: Picker не используется в веб-версии модального окна
// import { Picker } from '@react-native-picker/picker';

export type { BookSettings, ChecklistSection } from './BookSettingsModal.types';
export type { PdfThemeName };

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

export default function BookSettingsModal({
  visible,
  onClose,
  onSave,
  onPreview,
  defaultSettings,
  travelCount,
  userName: _userName,
  mode: _mode = 'save',
}: BookSettingsModalProps) {
  const { isDark } = useTheme();
  const { isPremium, requireUnlock, trackPaywallView } = usePdfPremium();
  const themed = resolveThemed(isDark);
  const MODAL_COLORS = buildModalColors(themed);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  const [settings, setSettings] = useState<BookSettings>(() =>
    buildInitialSettings(defaultSettings)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ УЛУЧШЕНИЕ: Focus trap для доступности
  useFocusTrap(dialogRef, {
    enabled: visible && Platform.OS === 'web',
    initialFocus: firstFocusableRef,
  });

  useEffect(() => {
    if (!visible) return;
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

    setSettings(buildInitialSettings(savedSettings || defaultSettings));
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  }, [visible, defaultSettings]);

  // ✅ УЛУЧШЕНИЕ: Валидация настроек
  useEffect(() => {
    const errors: string[] = [];

    if (settings.subtitle && settings.subtitle.length > 150) {
      errors.push(i18nT('profile:components.export.BookSettingsModal.podzagolovok_ne_dolzhen_prevyshat_150_simvol_67705c6a'));
    }

    if (settings.includeChecklists && settings.checklistSections.length === 0) {
      errors.push(i18nT('profile:components.export.BookSettingsModal.vyberite_hotya_by_odin_razdel_chek_lista_ili_18ec07d4'));
    }

    setValidationErrors(errors);
  }, [settings]);

  // ✅ Обработчик закрытия: несохраненные правки отбрасываются (стандартно для модалки настроек)
  const handleClose = useCallback(() => {
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
    setSettings((prev) => ({
      ...preset.settings,
      title: prev.title, // Сохраняем пользовательский заголовок
      subtitle: prev.subtitle,
    }));
    setSelectedPresetId(preset.id);
    setHasUnsavedChanges(true);
  }, []);

  const handleThemeSelect = useCallback((theme: PdfThemeName) => {
    setSettings((prev) => ({ ...prev, template: theme }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSettingsChange = useCallback((updates: Partial<BookSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

  // Гейт галерейных правок: журнальные раскладки / overlay-подписи / full-bleed
  // доступны только в премиуме (#298). Не-премиум значения проходят как обычно.
  const handleGalleryChange = useCallback(
    (updates: Partial<BookSettings>) => {
      if (!isPremium && gallerySettingNeedsPremium(updates)) {
        trackPaywallView('gallery-premium');
        requireUnlock('gallery-premium');
        return;
      }
      handleSettingsChange(updates);
    },
    [isPremium, trackPaywallView, requireUnlock, handleSettingsChange],
  );

  // Гейт типа обложки: «Свое изображение» (custom) — премиум (#298).
  const handleCoverTypeChange = useCallback(
    (coverType: BookSettings['coverType']) => {
      if (!isPremium && isPremiumCoverType(coverType)) {
        trackPaywallView('cover-custom');
        requireUnlock('cover-custom');
        return;
      }
      handleSettingsChange({ coverType });
    },
    [isPremium, trackPaywallView, requireUnlock, handleSettingsChange],
  );

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
    if (isSaving) return;
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
      if (mountedRef.current) setIsSaving(false);
      onClose();
    } catch (error) {
      console.error('Failed to save PDF settings:', error);
      void showToast({
        type: 'error',
        text1: i18nT('profile:components.export.BookSettingsModal.ne_udalos_sohranit_nastroyki_pdf_c17e83ed'),
        position: 'bottom',
      });
      if (mountedRef.current) setIsSaving(false);
    }
  }, [isSaving, settings, validationErrors, onSave, onClose]);

  const handlePreview = useCallback(async () => {
    if (!onPreview) return;
    if (isSaving) return;

    if (validationErrors.length > 0) {
      // Ошибки уже показаны в UI, просто не даем создать превью
      return;
    }

    setIsSaving(true);
    try {
      await onPreview(settings);
      if (mountedRef.current) setIsSaving(false);
      onClose();
    } catch (error) {
      console.error('Failed to generate preview:', error);
      void showToast({
        type: 'error',
        text1: i18nT('profile:components.export.BookSettingsModal.ne_udalos_sozdat_prevyu_pdf_66bbe2ed'),
        position: 'bottom',
      });
      if (mountedRef.current) setIsSaving(false);
    }
  }, [isSaving, settings, validationErrors, onPreview, onClose]);

  if (Platform.OS !== 'web') {
    return null; // Только для web
  }
  const hasSubtitleError = Boolean(settings.subtitle && settings.subtitle.length > 150);

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
            boxShadow: themed.boxShadows.modal as any,
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
            <span>{i18nT('profile:components.export.BookSettingsModal.nastroyki_fotoalboma_e7ea523f')}</span>
            {hasUnsavedChanges && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: MODAL_COLORS.accentLight,
                  color: MODAL_COLORS.accent,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title={i18nT('profile:components.export.BookSettingsModal.u_vas_est_nesohranennye_izmeneniya_503e03aa')}
              >
                <Feather name="circle" size={8} color={MODAL_COLORS.accent as any} />
                <span>{i18nT('profile:components.export.BookSettingsModal.ne_sohraneno_de358955')}</span>
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
                <Feather name="alert-triangle" size={16} color={MODAL_COLORS.errorDark as any} />
                <span>{i18nT('profile:components.export.BookSettingsModal.ispravte_oshibki_76b3c61b')}</span>
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
            border: `1px solid ${MODAL_COLORS.borderAccent}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
              <Feather name="book" size={20} color={MODAL_COLORS.primary as any} />
            </span>
            <div>
              <div style={{ color: MODAL_COLORS.text, fontSize: '14px', fontWeight: 500 }}>
                {i18nT('profile:components.export.BookSettingsModal.vybrano_puteshestviy_nbsp_4b4623d9')}<span style={{ fontWeight: 700, color: MODAL_COLORS.primary }}>{travelCount}</span>
              </div>
              <div style={{ fontSize: '12px', color: MODAL_COLORS.textMuted, marginTop: '2px' }}>
                {travelCount === 1
                  ? i18nT('profile:components.export.BookSettingsModal.budet_sozdana_kniga_s_odnim_puteshestviem_d6b28f6a')
                  : i18nT('profile:components.export.BookSettingsModal.budet_sozdana_kniga_s_value1_puteshestviyami_a78b68c9', { value1: travelCount })}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
              {i18nT('profile:components.export.BookSettingsModal.poryadok_puteshestviy_v_knige_3740cd72')}</label>
            <select
              value={settings.sortOrder}
              onChange={(e) => handleSettingsChange({ sortOrder: e.target.value as BookSettings['sortOrder'] })}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: `1.5px solid ${MODAL_COLORS.border}`,
                borderRadius: '12px',
                fontSize: '15px',
                minHeight: '44px',
                backgroundColor: MODAL_COLORS.surface,
                color: MODAL_COLORS.text,
                outlineWidth: 0,
                outlineStyle: 'none',
                outlineColor: 'transparent',
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
              <option value="manual">{i18nT('profile:components.export.BookSettingsModal.kak_raspolozheno_v_spiske_vybora_c2ec73ee')}</option>
              <option value="date-desc">{i18nT('profile:components.export.BookSettingsModal.snachala_novye_po_godu_71456114')}</option>
              <option value="date-asc">{i18nT('profile:components.export.BookSettingsModal.snachala_starye_po_godu_3c9621e6')}</option>
              <option value="country">{i18nT('profile:components.export.BookSettingsModal.po_strane_7e37bb82')}</option>
              <option value="alphabetical">{i18nT('profile:components.export.BookSettingsModal.po_nazvaniyu_e17e92ac')}</option>
            </select>
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
                  onLayoutSelect={(layout) => handleGalleryChange({ galleryLayout: layout })}
                  columns={settings.galleryColumns}
                  onColumnsChange={(cols) => handleSettingsChange({ galleryColumns: cols })}
                  photosPerPage={settings.galleryPhotosPerPage}
                  onPhotosPerPageChange={(count) => handleSettingsChange({ galleryPhotosPerPage: count })}
                  twoPerPageLayout={settings.galleryTwoPerPageLayout}
                  onTwoPerPageLayoutChange={(layout) => handleSettingsChange({ galleryTwoPerPageLayout: layout })}
                  showCaptions={settings.showCaptions}
                  onShowCaptionsChange={(show) => handleSettingsChange({ showCaptions: show })}
                  captionPosition={settings.captionPosition}
                  onCaptionPositionChange={(pos) => handleGalleryChange({ captionPosition: pos })}
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
                title={showAdvanced ? i18nT('profile:components.export.BookSettingsModal.skryt_nastroyki_oblozhki_i_zagolovkov_d3b42861') : i18nT('profile:components.export.BookSettingsModal.pokazat_nastroyki_oblozhki_i_zagolovkov_a979398b')}
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
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
                <Feather
                  name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={MODAL_COLORS.textMuted as any}
                />
                <span>{showAdvanced ? i18nT('profile:components.export.BookSettingsModal.skryt_detalnye_nastroyki_00de2214') : i18nT('profile:components.export.BookSettingsModal.pokazat_detalnye_nastroyki_6805c889')}</span>
              </button>
            </div>

            {showAdvanced && (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    {i18nT('profile:components.export.BookSettingsModal.nazvanie_knigi_8e3417de')}<span style={{ color: MODAL_COLORS.error, marginLeft: '4px' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => handleSettingsChange({ title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${MODAL_COLORS.border}`,
                      borderRadius: '12px',
                      fontSize: '15px',
                      minHeight: '44px',
                      backgroundColor: MODAL_COLORS.surface,
                      color: MODAL_COLORS.text,
                      outlineWidth: 0,
                      outlineStyle: 'none',
                      outlineColor: 'transparent',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                      e.target.style.backgroundColor = MODAL_COLORS.surface;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.border as any;
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder={i18nT('profile:components.export.BookSettingsModal.moi_puteshestviya_1e06ca97')}
                    aria-required="true"
                    aria-invalid={false}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    {i18nT('profile:components.export.BookSettingsModal.podzagolovok_optsionalno_de116b87')}</label>
                  <input
                    type="text"
                    value={settings.subtitle || ''}
                    onChange={(e) => handleSettingsChange({ subtitle: e.target.value || undefined })}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${hasSubtitleError ? MODAL_COLORS.error : MODAL_COLORS.border}`,
                      borderRadius: '12px',
                      fontSize: '15px',
                      minHeight: '44px',
                      backgroundColor: MODAL_COLORS.surface,
                      color: MODAL_COLORS.text,
                      outlineWidth: 0,
                      outlineStyle: 'none',
                      outlineColor: 'transparent',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = MODAL_COLORS.primary;
                      e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`;
                      e.target.style.backgroundColor = MODAL_COLORS.surface;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = hasSubtitleError ? (MODAL_COLORS.error as any) : (MODAL_COLORS.border as any);
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder={i18nT('profile:components.export.BookSettingsModal.vospominaniya_2024_26790f52')}
                    maxLength={150}
                    aria-invalid={hasSubtitleError}
                  />
                  <div style={{ fontSize: '11px', color: MODAL_COLORS.textMuted, marginTop: '4px', textAlign: 'right' }}>
                    {(settings.subtitle || '').length}{i18nT('profile:components.export.BookSettingsModal.150_simvolov_629dcb35')}</div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
                    {i18nT('profile:components.export.BookSettingsModal.tip_oblozhki_7559bcbb')}</label>
                  <select
                    value={settings.coverType}
                    onChange={(e) => handleCoverTypeChange(e.target.value as BookSettings['coverType'])}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${MODAL_COLORS.border}`,
                      borderRadius: '12px',
                      fontSize: '15px',
                      minHeight: '44px',
                      backgroundColor: MODAL_COLORS.surface,
                      color: MODAL_COLORS.text,
                      outlineWidth: 0,
                      outlineStyle: 'none',
                      outlineColor: 'transparent',
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
                    <option value="auto">{i18nT('profile:components.export.BookSettingsModal.avtomaticheskaya_luchshee_foto_b3153151')}</option>
                    <option value="first-photo">{i18nT('profile:components.export.BookSettingsModal.pervoe_foto_pervogo_puteshestviya_d2effeb3')}</option>
                    <option value="gradient">{i18nT('profile:components.export.BookSettingsModal.gradient_11017575')}</option>
                    <option value="custom">
                      {isPremium ? i18nT('profile:components.export.BookSettingsModal.svoe_izobrazhenie_5c69c342') : i18nT('profile:components.export.BookSettingsModal.svoe_izobrazhenie_premium_373d7f86')}
                    </option>
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
                    {i18nT('profile:components.export.BookSettingsModal.vklyuchit_oglavlenie_3a5ca805')}</div>
                  <div style={{ fontSize: '12px', color: MODAL_COLORS.textMuted, marginTop: '2px' }}>
                    {i18nT('profile:components.export.BookSettingsModal.s_miniatyurami_i_nomerami_stranits_0647b357')}</div>
                </div>
              </label>
            </div>

            <ChecklistFieldset
              settings={settings}
              checklistSections={checklistSections}
              MODAL_COLORS={MODAL_COLORS}
              themed={themed}
              onToggleChecklists={handleToggleChecklists}
              onToggleSection={toggleChecklistSection}
            />
          </div>
          <ModalFooter
            MODAL_COLORS={MODAL_COLORS}
            themed={themed}
            isSaving={isSaving}
            validationErrors={validationErrors}
            onPreview={onPreview}
            firstFocusableRef={firstFocusableRef}
            onClose={handleClose}
            onSave={handleSave}
            onPreviewClick={handlePreview}
          />
        </div>
      </div>

    </Modal>
  );
}
