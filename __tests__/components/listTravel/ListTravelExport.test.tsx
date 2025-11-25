// __tests__/components/listTravel/ListTravelExport.test.tsx
// Тесты экспортной панели (ExportBar) на странице списка путешествий

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExportBar } from '@/components/listTravel/ListTravel';

describe('ExportBar', () => {
  const setup = (overrides: Partial<React.ComponentProps<typeof ExportBar>> = {}) => {
    const onToggleSelectAll = jest.fn();
    const onClearSelection = jest.fn();
    const onPreview = jest.fn();
    const onSave = jest.fn();
    const onSettings = jest.fn();

    const props: React.ComponentProps<typeof ExportBar> = {
      isMobile: false,
      selectedCount: 2,
      allCount: 3,
      onToggleSelectAll,
      onClearSelection,
      onPreview,
      onSave,
      onSettings,
      isGenerating: false,
      progress: 0,
      settingsSummary: 'A4 • Книжная • minimal',
      hasSelection: true,
      ...overrides,
    };

    const utils = render(<ExportBar {...props} />);
    return { ...utils, onToggleSelectAll, onClearSelection, onPreview, onSave, onSettings };
  };

  it('отображает текст о выбранных путешествиях и кнопки экспорта', () => {
    const { getByText } = setup();

    expect(getByText(/Выбрано 2 /)).toBeTruthy();
    expect(getByText('Настройки')).toBeTruthy();
    expect(getByText('Сохранить PDF')).toBeTruthy();
    expect(getByText('Превью (2)')).toBeTruthy();
  });

  it('вызывает onToggleSelectAll и onClearSelection при нажатии на соответствующие ссылки', () => {
    const { getByText, onToggleSelectAll, onClearSelection } = setup();

    fireEvent.press(getByText('Выбрать все'));
    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Очистить выбор'));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('вызывает onPreview и onSave при нажатии на кнопки', () => {
    const { getByText, onPreview, onSave } = setup();

    fireEvent.press(getByText('Превью (2)'));
    expect(onPreview).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Сохранить PDF'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('не вызывает onPreview/onSave, если нет выбора или идёт генерация', () => {
    const { getByText, onPreview, onSave } = setup({ hasSelection: false });

    fireEvent.press(getByText('Превью (2)'));
    fireEvent.press(getByText('Сохранить PDF'));

    expect(onPreview).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
