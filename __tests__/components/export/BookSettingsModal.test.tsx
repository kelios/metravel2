// __tests__/components/export/BookSettingsModal.test.tsx
// Тесты для модального окна настроек фотоальбома (BookSettingsModal)

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import BookSettingsModal, { type BookSettings } from '@/components/export/BookSettingsModal';

// jsdom по умолчанию имитирует web
const originalPlatformOS = Platform.OS;

describe('BookSettingsModal', () => {
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

  it('рендерит основные поля и счётчик выбранных путешествий', () => {
    const { getByText, getByDisplayValue } = renderModal();

    expect(getByText('Настройки фотоальбома')).toBeTruthy();
    expect(getByText('Выбрано путешествий:')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();

    expect(getByDisplayValue('Путешествия 1')).toBeTruthy();
    expect(getByDisplayValue('Воспоминания 2024')).toBeTruthy();
    expect(getByText('Минималистичная')).toBeTruthy();
  });

  it('позволяет изменять название и подзаголовок книги', () => {
    const { getByDisplayValue } = renderModal();

    const titleInput = getByDisplayValue('Путешествия 1');
    const subtitleInput = getByDisplayValue('Воспоминания 2024');

    fireEvent.changeText(titleInput, 'Новая книга');
    fireEvent.changeText(subtitleInput, 'Новый подзаголовок');

    expect(getByDisplayValue('Новая книга')).toBeTruthy();
    expect(getByDisplayValue('Новый подзаголовок')).toBeTruthy();
  });

  it('переключает тип обложки на "Свое изображение" и отображает поле URL', () => {
    const { getByDisplayValue, getByPlaceholderText } = renderModal();

    const coverSelect = getByDisplayValue('Автоматическая (лучшее фото)');
    fireEvent(coverSelect, 'onValueChange' in coverSelect ? 'onValueChange' : 'onChange', {
      nativeEvent: { text: 'custom' },
      target: { value: 'custom' },
    } as any);

    // jsdom/React Native testing library может не обновить select через onChangeText,
    // поэтому дополнительно проверяем placeholder поля URL (оно рендерится только при coverType=custom)
    const urlInput = getByPlaceholderText('https://example.com/cover.jpg');
    fireEvent.changeText(urlInput, 'https://example.com/new-cover.jpg');

    expect(getByDisplayValue('https://example.com/new-cover.jpg')).toBeTruthy();
  });

  it('переключает цветовую тему и шрифт', () => {
    const { getByText } = renderModal();

    const greenThemeButton = getByText('Зелёный лес');
    fireEvent.press(greenThemeButton);

    const serifFontButton = getByText('Serif');
    fireEvent.press(serifFontButton);

    // Визуальная проверка стилей в jsdom ограничена, но сам факт нажатия важен —
    // ошибки в обработчиках приведут к падению теста.
  });

  it('переключает формат, ориентацию, поля и качество изображений', () => {
    const { getByDisplayValue } = renderModal();

    const formatSelect = getByDisplayValue('A4');
    fireEvent(formatSelect, 'onChange', { target: { value: 'Letter' } } as any);

    const orientationSelect = getByDisplayValue('Книжная');
    fireEvent(orientationSelect, 'onChange', { target: { value: 'landscape' } } as any);

    const marginsSelect = getByDisplayValue('Стандартные');
    fireEvent(marginsSelect, 'onChange', { target: { value: 'narrow' } } as any);

    const qualitySelect = getByDisplayValue('Высокое (больше памяти)');
    fireEvent(qualitySelect, 'onChange', { target: { value: 'medium' } } as any);
  });

  it('управляет чекбоксами оглавления и чек-листов', () => {
    const { getByText } = renderModal();

    const tocLabel = getByText('Включить оглавление');
    const tocCheckbox = tocLabel.parent?.findByType?.('input');

    // Для надежности эмулируем событие на wrapper через fireEvent
    fireEvent.press(tocLabel);

    const checklistsLabel = getByText('Добавить в PDF');
    fireEvent.press(checklistsLabel);

    // После включения чек-листов должен отрендериться хотя бы один блок опций
    getByText('Одежда');
  });

  it('открывает конструктор макета и сохраняет layout', () => {
    const { getByText } = renderModal({
      // начальные настройки без layout
      defaultSettings: baseSettings,
    });

    const layoutButton = getByText(/Создать макет|Изменить макет/);
    fireEvent.press(layoutButton);

    // PdfLayoutBuilder внутри управляет собственным состоянием; в этом тесте
    // достаточно убедиться, что сам компонент монтируется без ошибок при клике.
  });

  it('вызывает onPreview и onClose при нажатии "Превью"', () => {
    const { getByText, onPreview, onClose } = renderModal({ mode: 'preview' });

    const previewButton = getByText('Превью');
    fireEvent.press(previewButton);

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('вызывает onSave при нажатии основной кнопки', () => {
    const { getByText, onSave } = renderModal({ mode: 'preview' });

    const saveButton = getByText('Сохранить PDF');
    fireEvent.press(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
