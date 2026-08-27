import React, { useState } from 'react';
import { fireEvent, render, StyleSheet } from '@testing-library/react-native';

import TripPlanDescriptionEditor from '@/components/trips/planning/TripPlanDescriptionEditor';

let mockIsMobile = false;

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isHydrated: true, isMobile: mockIsMobile }),
}));

jest.mock('@/hooks/useSoftKeyboardInset', () => ({
  useSoftKeyboardInset: () => ({ contentViewportInset: 0, rootBottomOverlap: 0 }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: 'white',
    border: 'gray',
    danger: 'red',
    overlay: 'rgba(0,0,0,0.5)',
    primary: 'teal',
    primaryDark: 'darkslategray',
    surface: 'white',
    text: 'black',
    textMuted: 'gray',
  }),
}));

function EditorHarness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <TripPlanDescriptionEditor
      value={value}
      onChangeText={setValue}
      label="Описание"
      placeholder="Описание поездки"
    />
  );
}

describe('TripPlanDescriptionEditor', () => {
  beforeEach(() => {
    mockIsMobile = false;
  });

  it('shows at least eight inline rows and keeps a 44px mobile fullscreen target', () => {
    mockIsMobile = true;
    const { getByTestId } = render(<EditorHarness />);

    const input = getByTestId('trip-plan-edit-description');
    expect(input.props.multiline).toBe(true);
    expect(input.props.numberOfLines).toBe(8);
    const inputStyle = StyleSheet.flatten(input.props.style);
    expect(inputStyle.minHeight).toBeGreaterThanOrEqual(178);
    expect(inputStyle.width).toBe('100%');

    const openButton = getByTestId('trip-plan-description-open-fullscreen');
    const openButtonStyle = StyleSheet.flatten(
      openButton.props.style({ pressed: false }),
    );
    expect(openButtonStyle.width).toBeGreaterThanOrEqual(44);
    expect(openButtonStyle.height).toBeGreaterThanOrEqual(44);
    expect(openButton.props.accessibilityLabel).toBe('Открыть описание на весь экран');

    fireEvent.press(openButton);
    expect(getByTestId('trip-plan-description-keyboard-frame')).toBeTruthy();
    expect(getByTestId('trip-plan-description-fullscreen-input').props.multiline).toBe(true);
  });

  it('keeps a 2000-character draft and selection across close and reopen', () => {
    const longDescription = 'Длинное описание поездки. '.repeat(80);
    expect(longDescription.length).toBeGreaterThan(2000);
    const { getByTestId, queryByTestId } = render(<EditorHarness />);

    const inlineInput = getByTestId('trip-plan-edit-description');
    fireEvent.changeText(inlineInput, longDescription);
    fireEvent(inlineInput, 'selectionChange', {
      nativeEvent: { selection: { start: 120, end: 165 } },
    });
    fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));

    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe(
      longDescription,
    );
    expect(getByTestId('trip-plan-description-fullscreen-input').props.selection).toEqual({
      start: 120,
      end: 165,
    });
    // A trailing blur/selection event from the field behind the modal must not
    // consume the restore intended for the freshly mounted fullscreen input.
    fireEvent(inlineInput, 'selectionChange', {
      nativeEvent: { selection: { start: 0, end: 0 } },
    });
    expect(getByTestId('trip-plan-description-fullscreen-input').props.selection).toEqual({
      start: 120,
      end: 165,
    });
    expect(
      String(getByTestId('trip-plan-description-count').props.children).replace(/\D/g, ''),
    ).toBe(String(longDescription.length));

    fireEvent.press(getByTestId('trip-plan-description-close'));
    expect(queryByTestId('trip-plan-description-fullscreen')).toBeNull();
    expect(getByTestId('trip-plan-edit-description').props.value).toBe(longDescription);
    expect(getByTestId('trip-plan-edit-description').props.selection).toEqual({
      start: 120,
      end: 165,
    });

    fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    expect(getByTestId('trip-plan-description-fullscreen-input').props.selection).toEqual({
      start: 120,
      end: 165,
    });
  });

  it('does not keep the cursor controlled during ordinary typing', () => {
    const { getByTestId } = render(<EditorHarness initialValue="Начало конец" />);
    const inlineInput = getByTestId('trip-plan-edit-description');

    fireEvent(inlineInput, 'selectionChange', {
      nativeEvent: { selection: { start: 7, end: 7 } },
    });
    fireEvent.changeText(inlineInput, 'Начало текста конец');

    expect(getByTestId('trip-plan-edit-description').props.selection).toBeUndefined();
  });

  it('replaces the captured selection with a safe URL and restores the cursor', () => {
    const initialValue = 'Встречаемся здесь после обеда';
    const selectedStart = initialValue.indexOf('здесь');
    const selectedEnd = selectedStart + 'здесь'.length;
    const { getByTestId } = render(<EditorHarness initialValue={initialValue} />);

    fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    const fullscreenInput = getByTestId('trip-plan-description-fullscreen-input');
    fireEvent(fullscreenInput, 'selectionChange', {
      nativeEvent: { selection: { start: selectedStart, end: selectedEnd } },
    });
    fireEvent.press(getByTestId('trip-plan-description-add-link'));
    fireEvent.changeText(
      getByTestId('trip-plan-description-link-input'),
      'https://example.com/meeting',
    );
    fireEvent.press(getByTestId('trip-plan-description-link-insert'));

    const expected = 'Встречаемся https://example.com/meeting после обеда';
    const updatedInput = getByTestId('trip-plan-description-fullscreen-input');
    expect(updatedInput.props.value).toBe(expected);
    const expectedCursor = selectedStart + 'https://example.com/meeting'.length;
    expect(updatedInput.props.selection).toEqual({
      start: expectedCursor,
      end: expectedCursor,
    });
  });

  it('accepts an internal relative address and rejects unsafe schemes observably', () => {
    const initialValue = 'Маршрут: ';
    const { getByTestId, queryByTestId } = render(
      <EditorHarness initialValue={initialValue} />,
    );

    fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    fireEvent.press(getByTestId('trip-plan-description-add-link'));
    fireEvent.changeText(getByTestId('trip-plan-description-link-input'), '/trips/my');
    fireEvent.press(getByTestId('trip-plan-description-link-insert'));
    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe(
      'Маршрут: https://metravel.by/trips/my',
    );

    const safeValue = getByTestId('trip-plan-description-fullscreen-input').props.value;
    fireEvent.press(getByTestId('trip-plan-description-add-link'));
    fireEvent.changeText(
      getByTestId('trip-plan-description-link-input'),
      'javascript:alert(1)',
    );
    fireEvent.press(getByTestId('trip-plan-description-link-insert'));

    expect(getByTestId('trip-plan-description-link-error').props.accessibilityRole).toBe('alert');
    expect(queryByTestId('trip-plan-description-link-dialog')).toBeTruthy();
    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe(safeValue);
  });

  it('cancels link insertion without changing the draft and restores its selection', () => {
    const initialValue = 'Отель у вокзала';
    const selectedStart = initialValue.indexOf('вокзала');
    const selectedEnd = selectedStart + 'вокзала'.length;
    const { getByTestId } = render(<EditorHarness initialValue={initialValue} />);

    fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    fireEvent(getByTestId('trip-plan-description-fullscreen-input'), 'selectionChange', {
      nativeEvent: { selection: { start: selectedStart, end: selectedEnd } },
    });
    fireEvent.press(getByTestId('trip-plan-description-add-link'));
    fireEvent.changeText(getByTestId('trip-plan-description-link-input'), 'example.com/hotel');
    fireEvent.press(getByTestId('trip-plan-description-link-cancel'));

    const fullscreenInput = getByTestId('trip-plan-description-fullscreen-input');
    expect(fullscreenInput.props.value).toBe(initialValue);
    expect(fullscreenInput.props.selection).toEqual({
      start: selectedStart,
      end: selectedEnd,
    });
  });

  it('keeps native copy/cut/paste behavior and closes Done without a hidden callback', () => {
    const onChangeText = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <TripPlanDescriptionEditor
        value="Текст для выделения"
        onChangeText={onChangeText}
        label="Описание"
        placeholder="Описание поездки"
      />,
    );

    const inlineInput = getByTestId('trip-plan-edit-description');
    expect(inlineInput.props.contextMenuHidden).toBeUndefined();
    expect(inlineInput.props.selectTextOnFocus).toBeUndefined();
    fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    const fullscreenInput = getByTestId('trip-plan-description-fullscreen-input');
    expect(fullscreenInput.props.contextMenuHidden).toBeUndefined();
    fireEvent.press(getByTestId('trip-plan-description-done'));

    expect(queryByTestId('trip-plan-description-fullscreen')).toBeNull();
    expect(onChangeText).not.toHaveBeenCalled();
  });
});
