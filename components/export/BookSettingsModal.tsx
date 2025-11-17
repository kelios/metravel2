// components/export/BookSettingsModal.tsx
// ✅ УЛУЧШЕНИЕ: Модальное окно настроек фотоальбома

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

// ✅ Экспортируем интерфейс для использования в других компонентах
export interface BookSettings {
  title: string;
  subtitle?: string;
  coverType: 'auto' | 'first-photo' | 'gradient' | 'custom';
  coverImage?: string;
  template: 'classic' | 'modern' | 'romantic' | 'adventure' | 'minimal';
  format: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margins: 'standard' | 'narrow' | 'wide';
  imageQuality: 'high' | 'medium' | 'low';
  sortOrder: 'date-desc' | 'date-asc' | 'country' | 'alphabetical';
  includeToc: boolean;
  includeGallery: boolean;
  includeMap: boolean;
}

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
  template: 'classic',
  format: 'A4',
  orientation: 'portrait',
  margins: 'standard',
  imageQuality: 'high',
  sortOrder: 'date-desc',
  includeToc: true,
  includeGallery: true,
  includeMap: true,
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
  const [settings, setSettings] = useState<BookSettings>({
    ...defaultBookSettings,
    title: defaultSettings?.title || (userName ? `Путешествия ${userName}` : 'Мои путешествия'),
    ...defaultSettings,
  });

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
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              margin: '0 0 20px 0',
              color: '#1f2937',
            }}
          >
            Настройки фотоальбома
          </h2>

        <div style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
          Выбрано путешествий:&nbsp;
          <span style={{ fontWeight: 600, color: '#111827' }}>{travelCount}</span>
        </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
              Название книги
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
              }}
              placeholder="Мои путешествия"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
              Подзаголовок (опционально)
            </label>
            <input
              type="text"
              value={settings.subtitle || ''}
              onChange={(e) => setSettings({ ...settings, subtitle: e.target.value || undefined })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
              }}
              placeholder="Воспоминания 2024"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
              Тип обложки
            </label>
            <select
              value={settings.coverType}
              onChange={(e) => setSettings({ ...settings, coverType: e.target.value as any })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                Ссылка на изображение обложки
              </label>
              <input
                type="url"
                value={settings.coverImage || ''}
                onChange={(e) => setSettings({ ...settings, coverImage: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
                placeholder="https://example.com/cover.jpg"
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
              Шаблон оформления
            </label>
            <select
              value={settings.template}
              onChange={(e) => setSettings({ ...settings, template: e.target.value as any })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            >
              <option value="classic">Классический</option>
              <option value="modern">Современный</option>
              <option value="romantic">Романтический</option>
              <option value="adventure">Приключенческий</option>
              <option value="minimal">Минималистичный</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                Формат
              </label>
              <select
                value={settings.format}
                onChange={(e) => setSettings({ ...settings, format: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                Ориентация
              </label>
              <select
                value={settings.orientation}
                onChange={(e) => setSettings({ ...settings, orientation: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                <option value="portrait">Книжная</option>
                <option value="landscape">Альбомная</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                Поля страницы
              </label>
              <select
                value={settings.margins}
                onChange={(e) => setSettings({ ...settings, margins: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                <option value="standard">Стандартные</option>
                <option value="narrow">Узкие</option>
                <option value="wide">Широкие</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
                Качество изображений
              </label>
              <select
                value={settings.imageQuality}
                onChange={(e) => setSettings({ ...settings, imageQuality: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              >
                <option value="high">Высокое (больше памяти)</option>
                <option value="medium">Среднее</option>
                <option value="low">Низкое (меньше памяти)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151' }}>
              Сортировка
            </label>
            <select
              value={settings.sortOrder}
              onChange={(e) => setSettings({ ...settings, sortOrder: e.target.value as any })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
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
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 500, color: '#374151' }}>Включить оглавление</span>
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includeGallery}
                onChange={(e) => setSettings({ ...settings, includeGallery: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 500, color: '#374151' }}>Включить галереи фотографий</span>
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includeMap}
                onChange={(e) => setSettings({ ...settings, includeMap: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: 500, color: '#374151' }}>Включить карты и координаты</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            {onPreview && mode === 'preview' && (
              <button
                onClick={handlePreview}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ff9f5a',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  color: '#ff9f5a',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Превью
              </button>
            )}
            <button
              onClick={handleSave}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#ff9f5a',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {mode === 'preview' ? 'Сохранить PDF' : 'Применить'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

