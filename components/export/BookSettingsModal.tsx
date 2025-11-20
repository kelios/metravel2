// components/export/BookSettingsModal.tsx
// ✅ УЛУЧШЕНИЕ: Модальное окно настроек фотоальбома

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, Platform } from 'react-native';
// ✅ ИСПРАВЛЕНИЕ: Picker не используется в веб-версии модального окна
// import { Picker } from '@react-native-picker/picker';
import PdfLayoutBuilder from './PdfLayoutBuilder';
import type { PdfLayout } from '@/src/types/pdf-layout';

// ✅ Экспортируем интерфейс для использования в других компонентах
export interface BookSettings {
  title: string;
  subtitle?: string;
  coverType: 'auto' | 'first-photo' | 'gradient' | 'custom';
  coverImage?: string;
  template: 'minimal' | 'light' | 'dark' | 'travel-magazine' | 'classic' | 'modern' | 'romantic' | 'adventure';
  format: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margins: 'standard' | 'narrow' | 'wide';
  imageQuality: 'high' | 'medium' | 'low';
  sortOrder: 'date-desc' | 'date-asc' | 'country' | 'alphabetical';
  includeToc: boolean;
  includeGallery: boolean;
  includeMap: boolean;
  layout?: PdfLayout; // Пользовательский макет
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
  template: 'minimal',
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
  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);

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

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
              Шаблон оформления
            </label>
            <select
              value={settings.template}
              onChange={(e) => setSettings({ ...settings, template: e.target.value as any })}
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
              <option value="minimal">Минималистичная</option>
              <option value="light">Светлая</option>
              <option value="dark">Темная</option>
              <option value="travel-magazine">Travel Magazine</option>
              <option value="classic">Классический (legacy)</option>
              <option value="modern">Современный (legacy)</option>
              <option value="romantic">Романтический (legacy)</option>
              <option value="adventure">Приключенческий (legacy)</option>
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
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
                Поля страницы
              </label>
              <select
                value={settings.margins}
                onChange={(e) => setSettings({ ...settings, margins: e.target.value as any })}
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
                <option value="standard">Стандартные</option>
                <option value="narrow">Узкие</option>
                <option value="wide">Широкие</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#1f1f1f', fontSize: '14px' }}>
                Качество изображений
              </label>
              <select
                value={settings.imageQuality}
                onChange={(e) => setSettings({ ...settings, imageQuality: e.target.value as any })}
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
                <option value="high">Высокое (больше памяти)</option>
                <option value="medium">Среднее</option>
                <option value="low">Низкое (меньше памяти)</option>
              </select>
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

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includeGallery}
                onChange={(e) => setSettings({ ...settings, includeGallery: e.target.checked })}
                style={{ 
                  width: '20px',
                  height: '20px',
                  minWidth: '20px',
                  minHeight: '20px',
                  cursor: 'pointer',
                  accentColor: '#5b8a7a',
                }}
              />
              <span style={{ fontWeight: 500, color: '#1f1f1f', fontSize: '15px' }}>Включить галереи фотографий</span>
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includeMap}
                onChange={(e) => setSettings({ ...settings, includeMap: e.target.checked })}
                style={{ 
                  width: '20px',
                  height: '20px',
                  minWidth: '20px',
                  minHeight: '20px',
                  cursor: 'pointer',
                  accentColor: '#5b8a7a',
                }}
              />
              <span style={{ fontWeight: 500, color: '#1f1f1f', fontSize: '15px' }}>Включить карты и координаты</span>
            </label>
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
            {onPreview && mode === 'preview' && (
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
              {mode === 'preview' ? 'Сохранить PDF' : 'Применить'}
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

