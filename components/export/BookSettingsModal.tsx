// components/export/BookSettingsModal.tsx
// ✅ УЛУЧШЕНИЕ: Модальное окно настроек фотоальбома

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, Platform } from 'react-native';
// ✅ ИСПРАВЛЕНИЕ: Picker не используется в веб-версии модального окна
// import { Picker } from '@react-native-picker/picker';
import PdfLayoutBuilder from './PdfLayoutBuilder';
import type { PdfLayout } from '@/src/types/pdf-layout';

export type ColorThemeOption = 'blue' | 'green' | 'orange' | 'gray' | 'pastel' | 'mono';
export type FontOption = 'sans' | 'serif' | 'rounded';
export type PhotoModeOption = 'full' | 'gallery' | 'inline' | 'none';
export type MapModeOption = 'full-page' | 'inline' | 'none';
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
  template: 'minimal' | 'light' | 'dark' | 'travel-magazine' | 'classic' | 'modern' | 'romantic' | 'adventure';
  sortOrder: 'date-desc' | 'date-asc' | 'country' | 'alphabetical';
  includeToc: boolean;
  includeGallery: boolean;
  includeMap: boolean;
  colorTheme: ColorThemeOption;
  fontFamily: FontOption;
  photoMode: PhotoModeOption;
  mapMode: MapModeOption;
  includeChecklists: boolean;
  checklistSections: ChecklistSection[];
  layout?: PdfLayout; // Пользовательский макет
}

const DEFAULT_CHECKLIST_SELECTION: ChecklistSection[] = ['clothing', 'food', 'electronics'];

// Цветовые темы и шрифты теперь фиксированы через defaultBookSettings,
// поэтому отдельные массивы опций для UI не нужны.

const PHOTO_MODE_OPTIONS = [
  { value: 'full', label: 'Большие фото', description: 'Каждое фото занимает всю страницу' },
  { value: 'gallery', label: 'Галерея', description: '3–6 фото на страницу в сетке' },
  { value: 'inline', label: 'Фото в тексте', description: 'Мини-галерея прямо в описании' },
  { value: 'none', label: 'Без фото', description: 'Отключить фотоблоки' },
] as const;

const MAP_MODE_OPTIONS = [
  { value: 'full-page', label: 'Большая карта', description: 'Отдельная страница с маршрутом' },
  { value: 'inline', label: 'Мини-карта', description: 'Компактный блок рядом с текстом' },
  { value: 'none', label: 'Без карты', description: 'В книге не будет карт' },
] as const;

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
  colorTheme: 'blue',
  fontFamily: 'sans',
  photoMode: 'gallery',
  mapMode: 'full-page',
  includeChecklists: false,
  checklistSections: DEFAULT_CHECKLIST_SELECTION,
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

  merged.photoMode =
    overrides?.photoMode ??
    (merged.includeGallery === false ? 'none' : merged.photoMode || 'gallery');
  merged.includeGallery = merged.photoMode !== 'none';

  merged.mapMode =
    overrides?.mapMode ??
    (merged.includeMap === false ? 'none' : merged.mapMode || 'full-page');
  merged.includeMap = merged.mapMode !== 'none';

  merged.checklistSections =
    overrides?.checklistSections && overrides.checklistSections.length > 0
      ? overrides.checklistSections
      : DEFAULT_CHECKLIST_SELECTION;

  if (typeof merged.includeChecklists === 'undefined') {
    merged.includeChecklists = defaultBookSettings.includeChecklists;
  }

  merged.colorTheme = overrides?.colorTheme ?? merged.colorTheme;
  merged.fontFamily = overrides?.fontFamily ?? merged.fontFamily;

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
  mode = 'save',
}: BookSettingsModalProps) {
  const [settings, setSettings] = useState<BookSettings>(() =>
    buildInitialSettings(defaultSettings, userName)
  );
  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);

  useEffect(() => {
    setSettings(buildInitialSettings(defaultSettings, userName));
  }, [defaultSettings, userName]);

  const checklistSections = settings.checklistSections || [];

  const handlePhotoModeChange = (mode: PhotoModeOption) => {
    setSettings((prev) => ({
      ...prev,
      photoMode: mode,
      includeGallery: mode !== 'none',
    }));
  };

  const handleMapModeChange = (mode: MapModeOption) => {
    setSettings((prev) => ({
      ...prev,
      mapMode: mode,
      includeMap: mode !== 'none',
    }));
  };

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
          backgroundColor: 'rgba(31, 31, 31, 0.4)', // Матовый overlay
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: window.innerWidth <= 768 ? '20px' : '28px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 24px rgba(31, 31, 31, 0.12), 0 2px 4px rgba(31, 31, 31, 0.08)',
            border: '1px solid rgba(31, 31, 31, 0.08)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="modal-title"
            style={{
              fontSize: window.innerWidth <= 768 ? '20px' : '24px',
              fontWeight: 600,
              margin: '0 0 20px 0',
              color: '#1f1f1f',
              letterSpacing: '-0.3px',
            }}
          >
            Настройки фотоальбома
          </h2>

        <div style={{ marginBottom: '20px', color: '#4a4946', fontSize: '14px' }}>
          Выбрано путешествий:&nbsp;
          <span style={{ fontWeight: 600, color: '#1f1f1f' }}>{travelCount}</span>
        </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
              Название книги
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1.5px solid rgba(31, 31, 31, 0.08)',
                borderRadius: '12px',
                fontSize: '15px',
                minHeight: '44px',
                backgroundColor: '#ffffff',
                color: '#1f1f1f',
                outline: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5b8a7a';
                e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(31, 31, 31, 0.08)';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Мои путешествия"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
              Подзаголовок (опционально)
            </label>
            <input
              type="text"
              value={settings.subtitle || ''}
              onChange={(e) => setSettings({ ...settings, subtitle: e.target.value || undefined })}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1.5px solid rgba(31, 31, 31, 0.08)',
                borderRadius: '12px',
                fontSize: '15px',
                minHeight: '44px',
                backgroundColor: '#ffffff',
                color: '#1f1f1f',
                outline: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5b8a7a';
                e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(31, 31, 31, 0.08)';
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Воспоминания 2024"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
              Тип обложки
            </label>
            <select
              value={settings.coverType}
              onChange={(e) => setSettings({ ...settings, coverType: e.target.value as any })}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1.5px solid rgba(31, 31, 31, 0.08)',
                borderRadius: '12px',
                fontSize: '15px',
                minHeight: '44px',
                backgroundColor: '#ffffff',
                color: '#1f1f1f',
                outline: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5b8a7a';
                e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(31, 31, 31, 0.08)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="auto">Автоматическая (лучшее фото)</option>
              <option value="first-photo">Первое фото первого путешествия</option>
              <option value="gradient">Градиент</option>
              <option value="custom">Свое изображение</option>
            </select>
          </div>

          {settings.coverType === 'custom' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
                Ссылка на изображение обложки
              </label>
              <input
                type="url"
                value={settings.coverImage || ''}
                onChange={(e) => setSettings({ ...settings, coverImage: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1.5px solid rgba(31, 31, 31, 0.08)',
                  borderRadius: '12px',
                  fontSize: '15px',
                  backgroundColor: '#ffffff',
                  color: '#1f1f1f',
                  outline: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#5b8a7a';
                  e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(31, 31, 31, 0.08)';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="https://example.com/cover.jpg"
              />
            </div>
          )}

          {/* Шаблон, цветовая тема и шрифты сейчас фиксированы (minimal + базовая тема),
              поэтому отдельные переключатели в UI скрыты. */}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
              Фото-режим
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {PHOTO_MODE_OPTIONS.map((option) => {
                const isActive = settings.photoMode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handlePhotoModeChange(option.value)}
                    style={{
                      borderRadius: '14px',
                      border: isActive ? '2px solid #5b8a7a' : '1.5px solid rgba(31, 31, 31, 0.08)',
                      padding: '14px',
                      backgroundColor: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      minHeight: '90px',
                      boxShadow: isActive ? '0 6px 18px rgba(91, 138, 122, 0.12)' : '0 2px 6px rgba(31,31,31,0.04)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#1f1f1f', marginBottom: '6px' }}>{option.label}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
              Карты и география
            </label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {MAP_MODE_OPTIONS.map((option) => {
                const isActive = settings.mapMode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleMapModeChange(option.value)}
                    style={{
                      flex: '1 1 200px',
                      borderRadius: '12px',
                      border: isActive ? '2px solid #5b8a7a' : '1.5px solid rgba(31, 31, 31, 0.08)',
                      padding: '14px',
                      backgroundColor: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 6px 18px rgba(91, 138, 122, 0.12)' : '0 2px 6px rgba(31,31,31,0.04)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#1f1f1f', marginBottom: '6px' }}>{option.label}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
              Сортировка
            </label>
            <select
              value={settings.sortOrder}
              onChange={(e) => setSettings({ ...settings, sortOrder: e.target.value as any })}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1.5px solid rgba(31, 31, 31, 0.08)',
                borderRadius: '12px',
                fontSize: '15px',
                minHeight: '44px',
                backgroundColor: '#ffffff',
                color: '#1f1f1f',
                outline: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5b8a7a';
                e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(31, 31, 31, 0.08)';
                e.target.style.boxShadow = 'none';
              }}
            >
              <option value="date-desc">По дате (новые → старые)</option>
              <option value="date-asc">По дате (старые → новые)</option>
              <option value="country">По стране</option>
              <option value="alphabetical">По алфавиту</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includeToc}
                onChange={(e) => setSettings({ ...settings, includeToc: e.target.checked })}
                style={{ 
                  width: '20px', // ✅ ИСПРАВЛЕНИЕ: Увеличен размер
                  height: '20px', // ✅ ИСПРАВЛЕНИЕ: Увеличен размер
                  minWidth: '20px',
                  minHeight: '20px',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontWeight: 500, color: '#1f1f1f', fontSize: '15px' }}>Включить оглавление</span>
            </label>
          </div>

          <div style={{ marginBottom: '20px', padding: '18px', borderRadius: '14px', border: '1px solid rgba(31,31,31,0.08)', backgroundColor: '#f8f7f4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
                Чек-листы путешественника
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                <input
                  type="checkbox"
                  checked={settings.includeChecklists}
                  onChange={(e) => handleToggleChecklists(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#5b8a7a', cursor: 'pointer' }}
                />
                Добавить в PDF
              </label>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: settings.includeChecklists ? '12px' : 0 }}>
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
                        border: selected ? '2px solid #5b8a7a' : '1px solid rgba(31,31,31,0.12)',
                        padding: '12px',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        display: 'block',
                        boxShadow: selected ? '0 6px 18px rgba(91, 138, 122, 0.1)' : '0 1px 3px rgba(31,31,31,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, color: '#1f1f1f' }}>{option.label}</span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleChecklistSection(option.value)}
                          style={{ width: '18px', height: '18px', accentColor: '#5b8a7a', cursor: 'pointer' }}
                        />
                      </div>
                      <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: '#6b7280' }}>
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

          {/* Кнопка конструктора макета */}
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f5f4f2', borderRadius: '12px', border: '1px solid rgba(31, 31, 31, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
                Конструктор макета
              </label>
              {settings.layout && (
                <span style={{ fontSize: '13px', color: '#4a4946' }}>
                  {settings.layout.blocks.filter(b => b.enabled).length} блоков
                </span>
              )}
            </div>
            <button
              onClick={() => setShowLayoutBuilder(true)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#ffffff',
                border: '2px dashed #5b8a7a',
                borderRadius: '12px',
                color: '#5b8a7a',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '44px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5b8a7a';
                e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#5b8a7a';
                e.target.style.boxShadow = 'none';
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = '#e8f0ed';
                target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = '#ffffff';
                target.style.transform = 'translateY(0)';
              }}
            >
              <span>📐</span>
              <span>{settings.layout ? 'Изменить макет' : 'Создать макет'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '30px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 20px',
                border: '1px solid rgba(31, 31, 31, 0.08)',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                color: '#1f1f1f',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                boxShadow: '0 1px 3px rgba(31, 31, 31, 0.04)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5b8a7a';
                e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(31, 31, 31, 0.08)';
                e.target.style.boxShadow = '0 1px 3px rgba(31, 31, 31, 0.04)';
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = '#f5f4f2';
                target.style.transform = 'translateY(-1px)';
                target.style.boxShadow = '0 2px 6px rgba(31, 31, 31, 0.08)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = '#ffffff';
                target.style.transform = 'translateY(0)';
                target.style.boxShadow = '0 1px 3px rgba(31, 31, 31, 0.04)';
              }}
            >
              Отмена
            </button>
            {onPreview && (
              <button
                onClick={handlePreview}
                style={{
                  padding: '12px 20px',
                  border: '1px solid #5b8a7a',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  color: '#5b8a7a',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(31, 31, 31, 0.04)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#5b8a7a';
                  e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#5b8a7a';
                  e.target.style.boxShadow = '0 1px 3px rgba(31, 31, 31, 0.04)';
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = '#e8f0ed';
                  target.style.transform = 'translateY(-1px)';
                  target.style.boxShadow = '0 2px 6px rgba(31, 31, 31, 0.08)';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLButtonElement;
                  target.style.backgroundColor = '#ffffff';
                  target.style.transform = 'translateY(0)';
                  target.style.boxShadow = '0 1px 3px rgba(31, 31, 31, 0.04)';
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
                backgroundColor: '#5b8a7a',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                boxShadow: '0 2px 6px rgba(31, 31, 31, 0.06)',
              }}
              onFocus={(e) => {
                e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3), 0 2px 6px rgba(31, 31, 31, 0.06)';
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = '0 2px 6px rgba(31, 31, 31, 0.06)';
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = '#4a7264';
                target.style.transform = 'translateY(-1px)';
                target.style.boxShadow = '0 3px 8px rgba(31, 31, 31, 0.12)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.backgroundColor = '#5b8a7a';
                target.style.transform = 'translateY(0)';
                target.style.boxShadow = '0 2px 6px rgba(31, 31, 31, 0.06)';
                target.style.transform = 'translateY(0)';
              }}
            >
              Сохранить PDF
            </button>
          </div>
        </div>
      </div>

      {/* Конструктор макета */}
      <PdfLayoutBuilder
        visible={showLayoutBuilder}
        onClose={() => setShowLayoutBuilder(false)}
        onSave={(layout) => {
          setSettings({ ...settings, layout });
          setShowLayoutBuilder(false);
        }}
        initialLayout={settings.layout}
        travelCount={travelCount}
      />
    </Modal>
  );
}
