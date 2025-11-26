// __tests__/components/export/BookSettingsModal.test.tsx
// Базовые smoke-тесты для модального окна настроек фотоальбома

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import BookSettingsModal, { type BookSettings } from '@/components/export/BookSettingsModal';

jest.mock('@/components/export/PdfLayoutBuilder', () => {
  return ({ visible, onClose, onSave }: any) => {
    if (!visible) return null;
    return (
      <button
        data-testid="mock-layout-save"
        onClick={() => {
          onSave({ blocks: [{ id: '1', type: 'text', enabled: true }] });
          onClose();
        }}
      >
        Save Layout
      </button>
    );
  };
});

const originalPlatformOS = Platform.OS;

describe.skip('BookSettingsModal', () => {
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

  it('рендерит заголовок и счётчик выбранных путешествий (web)', () => {
    const { getByText } = renderModal();

    expect(getByText('Настройки фотоальбома')).toBeTruthy();
    expect(getByText('Выбрано путешествий:')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('не рендерится на не-web платформах', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });

    const { queryByText } = renderModal();

    expect(queryByText('Настройки фотоальбома')).toBeNull();

    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
  });

  it('вызывает onSave и onClose при сохранении', () => {
    const { getByText, onSave, onClose } = renderModal();

    const applyButton = getByText('Применить');
    fireEvent.press(applyButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].title).toBe(baseSettings.title);
  });

  it('вызывает onPreview и onClose в режиме preview', () => {
    const { getByText, onPreview, onClose } = renderModal({ mode: 'preview' });

    const previewButton = getByText('Превью');
    fireEvent.press(previewButton);

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.skip('позволяет включать чек-листы и выбирать секции', () => {
    const { getByText, getByLabelText } = renderModal({
      defaultSettings: {
        ...baseSettings,
        includeChecklists: false,
        checklistSections: [],
      },
    });

    const toggle = getByText('Добавить в PDF');
    fireEvent.press(toggle);

    const clothingCheckbox = getByLabelText('Одежда');
    fireEvent.press(clothingCheckbox);

    const saveButton = getByText('Применить');
    fireEvent.press(saveButton);
  });

  it.skip('сохраняет layout, полученный из PdfLayoutBuilder', () => {
    const { getByText, getByTestId, onSave } = renderModal({
      mode: 'preview',
    });

    const layoutButton = getByText('Создать макет');
    fireEvent.press(layoutButton);

    const saveLayout = getByTestId('mock-layout-save');
    fireEvent.press(saveLayout);

    const applyButton = getByText('Сохранить PDF');
    fireEvent.press(applyButton);

    expect(onSave).toHaveBeenCalled();
  });
});
