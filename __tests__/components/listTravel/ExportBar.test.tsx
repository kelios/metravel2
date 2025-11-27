import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ExportBar } from '@/components/listTravel/ListTravel';

describe('ExportBar', () => {
  const baseProps = {
    isMobile: false,
    selectedCount: 0,
    allCount: 10,
    onToggleSelectAll: jest.fn(),
    onClearSelection: jest.fn(),
    onPreview: jest.fn(),
    onSave: jest.fn(),
    onSettings: jest.fn(),
    isGenerating: false,
    progress: 0,
    settingsSummary: 'По умолчанию',
    hasSelection: false,
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default hint when nothing selected', () => {
    const { getByText } = render(<ExportBar {...baseProps} />);

    expect(getByText('Выберите путешествия для экспорта')).toBeTruthy();
    expect(getByText('Выберите хотя бы одно путешествие, чтобы включить кнопки')).toBeTruthy();
  });

  it('renders selection summary when some items are selected', () => {
    const { getByText } = render(
      <ExportBar
        {...baseProps}
        selectedCount={2}
        hasSelection={true}
        settingsSummary="2 путешествия"
      />
    );

    expect(getByText('Выбрано 2 путешествия')).toBeTruthy();
    expect(getByText('Настройки: 2 путешествия')).toBeTruthy();
  });

  it('calls handlers when buttons and links are pressed', () => {
    const props = {
      ...baseProps,
      selectedCount: 1,
      hasSelection: true,
    };

    const { getByText } = render(<ExportBar {...props} />);

    fireEvent.press(getByText('Выбрать все'));
    expect(props.onToggleSelectAll).toHaveBeenCalled();

    fireEvent.press(getByText('Очистить выбор'));
    expect(props.onClearSelection).toHaveBeenCalled();

    fireEvent.press(getByText('Сохранить PDF'));
    expect(props.onSave).toHaveBeenCalled();
  });

  it('disables actions when there is no selection', () => {
    const { getByText } = render(<ExportBar {...baseProps} />);

    expect(getByText('Сохранить PDF')).toBeDisabled();
  });

  it('renders mobile labels correctly', () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = 'ios';

    const { getByText } = render(
      <ExportBar
        {...baseProps}
        isMobile={true}
        selectedCount={3}
        hasSelection={true}
      />
    );

    expect(getByText('Сохранить PDF')).toBeTruthy();

    (Platform as any).OS = originalOS;
  });

  it('shows generating state when isGenerating is true', () => {
    const { getByText } = render(
      <ExportBar
        {...baseProps}
        selectedCount={2}
        hasSelection={true}
        isGenerating={true}
        progress={42}
      />
    );

    expect(getByText('Генерация... 42%')).toBeTruthy();
  });
});
