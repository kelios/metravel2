// __tests__/components/export/BookSettingsModal.test.tsx
// Базовые smoke-тесты для модального окна настроек фотоальбома

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import BookSettingsModal, { type BookSettings } from '@/components/export/BookSettingsModal';

const originalPlatformOS = Platform.OS;

describe.skip('BookSettingsModal (smoke)', () => {
  const baseSettings: Partial<BookSettings> = {
    title: 'Путешествия 1',
    subtitle: 'Воспоминания 2024',
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
    colorTheme: 'blue',
    fontFamily: 'sans',
    photoMode: 'gallery',
    mapMode: 'full-page',
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'],
  };

  const renderModal = (overrideProps: Partial<React.ComponentProps<typeof BookSettingsModal>> = {}) => {
    const onSave = jest.fn();
    const onPreview = jest.fn();
    const onClose = jest.fn();

    const utils = render(
      <BookSettingsModal
        visible
        onClose={onClose}
        onSave={onSave}
        onPreview={onPreview}
        defaultSettings={baseSettings}
        travelCount={2}
        userName="Julia"
        mode="preview"
        {...overrideProps}
      />
    );

    return { ...utils, onSave, onPreview, onClose };
  };

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it('рендерит заголовок и счётчик выбранных путешествий', () => {
    const { getByText } = renderModal();

    expect(getByText('Настройки фотоальбома')).toBeTruthy();
    expect(getByText('Выбрано путешествий:')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });
});
