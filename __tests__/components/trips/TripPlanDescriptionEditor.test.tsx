import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';

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

  it('keeps the fullscreen header inside ModalSafeArea (MODAL-TOP-INSET-001)', async () => {
    mockIsMobile = true;
    const { getByTestId } = await render(<EditorHarness initialValue="Текст" />);

    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));

    const safeArea = getByTestId('trip-plan-description-safe-area');
    expect(within(safeArea).getByTestId('trip-plan-description-fullscreen')).toBeTruthy();
    expect(within(safeArea).getByTestId('trip-plan-description-close')).toBeTruthy();
  });

  it('shows at least eight inline rows and keeps a 44px mobile fullscreen target', async () => {
    mockIsMobile = true;
    const { getByTestId } = await render(<EditorHarness />);

    const input = getByTestId('trip-plan-edit-description');
    expect(input.props.multiline).toBe(true);
    expect(input.props.numberOfLines).toBe(8);
    const inputStyle = StyleSheet.flatten(input.props.style);
    expect(inputStyle.minHeight).toBeGreaterThanOrEqual(178);
    expect(inputStyle.width).toBe('100%');

    const openButton = getByTestId('trip-plan-description-open-fullscreen');
    const rawOpenButtonStyle = openButton.props.style;
    const openButtonStyle = StyleSheet.flatten(
      typeof rawOpenButtonStyle === 'function'
        ? rawOpenButtonStyle({ pressed: false })
        : rawOpenButtonStyle,
    );
    expect(openButtonStyle.width).toBeGreaterThanOrEqual(44);
    expect(openButtonStyle.height).toBeGreaterThanOrEqual(44);
    expect(openButton.props.accessibilityLabel).toBe('Открыть описание на весь экран');

    await fireEvent.press(openButton);
    expect(getByTestId('trip-plan-description-keyboard-frame')).toBeTruthy();
    expect(getByTestId('trip-plan-description-fullscreen-input').props.multiline).toBe(true);
  });

  it('keeps a 2000-character draft and selection across close and reopen', async () => {
    const longDescription = 'Длинное описание поездки. '.repeat(80);
    expect(longDescription.length).toBeGreaterThan(2000);
    const { getByTestId, queryByTestId } = await render(<EditorHarness />);

    const inlineInput = getByTestId('trip-plan-edit-description');
    await fireEvent.changeText(inlineInput, longDescription);
    await fireEvent(inlineInput, 'selectionChange', {
      nativeEvent: { selection: { start: 120, end: 165 } },
    });
    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));

    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe(
      longDescription,
    );
    expect(getByTestId('trip-plan-description-fullscreen-input').props.selection).toEqual({
      start: 120,
      end: 165,
    });
    // A trailing blur/selection event from the field behind the modal must not
    // consume the restore intended for the freshly mounted fullscreen input.
    await fireEvent(inlineInput, 'selectionChange', {
      nativeEvent: { selection: { start: 0, end: 0 } },
    });
    expect(getByTestId('trip-plan-description-fullscreen-input').props.selection).toEqual({
      start: 120,
      end: 165,
    });
    expect(
      String(getByTestId('trip-plan-description-count').props.children).replace(/\D/g, ''),
    ).toBe(String(longDescription.length));

    await fireEvent.press(getByTestId('trip-plan-description-close'));
    expect(queryByTestId('trip-plan-description-fullscreen')).toBeNull();
    expect(getByTestId('trip-plan-edit-description').props.value).toBe(longDescription);
    expect(getByTestId('trip-plan-edit-description').props.selection).toEqual({
      start: 120,
      end: 165,
    });

    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    expect(getByTestId('trip-plan-description-fullscreen-input').props.selection).toEqual({
      start: 120,
      end: 165,
    });
  });

  it('does not keep the cursor controlled during ordinary typing', async () => {
    const { getByTestId } = await render(<EditorHarness initialValue="Начало конец" />);
    const inlineInput = getByTestId('trip-plan-edit-description');

    await fireEvent(inlineInput, 'selectionChange', {
      nativeEvent: { selection: { start: 7, end: 7 } },
    });
    await fireEvent.changeText(inlineInput, 'Начало текста конец');

    expect(getByTestId('trip-plan-edit-description').props.selection).toBeUndefined();
  });

  it('replaces the captured selection with a safe URL and restores the cursor', async () => {
    const initialValue = 'Встречаемся здесь после обеда';
    const selectedStart = initialValue.indexOf('здесь');
    const selectedEnd = selectedStart + 'здесь'.length;
    const { getByTestId } = await render(<EditorHarness initialValue={initialValue} />);

    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    const fullscreenInput = getByTestId('trip-plan-description-fullscreen-input');
    await fireEvent(fullscreenInput, 'selectionChange', {
      nativeEvent: { selection: { start: selectedStart, end: selectedEnd } },
    });
    await fireEvent.press(getByTestId('trip-plan-description-add-link'));
    await fireEvent.changeText(
      getByTestId('trip-plan-description-link-input'),
      'https://example.com/meeting',
    );
    await fireEvent.press(getByTestId('trip-plan-description-link-insert'));

    const expected = 'Встречаемся https://example.com/meeting после обеда';
    const updatedInput = getByTestId('trip-plan-description-fullscreen-input');
    expect(updatedInput.props.value).toBe(expected);
    const expectedCursor = selectedStart + 'https://example.com/meeting'.length;
    expect(updatedInput.props.selection).toEqual({
      start: expectedCursor,
      end: expectedCursor,
    });
  });

  it('accepts an internal relative address and rejects unsafe schemes observably', async () => {
    const initialValue = 'Маршрут: ';
    const { getByTestId, queryByTestId } = await render(
      <EditorHarness initialValue={initialValue} />,
    );

    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    await fireEvent.press(getByTestId('trip-plan-description-add-link'));
    await fireEvent.changeText(getByTestId('trip-plan-description-link-input'), '/trips/my');
    await fireEvent.press(getByTestId('trip-plan-description-link-insert'));
    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe(
      'Маршрут: https://metravel.by/trips/my',
    );

    const safeValue = getByTestId('trip-plan-description-fullscreen-input').props.value;
    await fireEvent.press(getByTestId('trip-plan-description-add-link'));
    await fireEvent.changeText(
      getByTestId('trip-plan-description-link-input'),
      'javascript:alert(1)',
    );
    await fireEvent.press(getByTestId('trip-plan-description-link-insert'));

    expect(getByTestId('trip-plan-description-link-error').props.accessibilityRole).toBe('alert');
    expect(queryByTestId('trip-plan-description-link-dialog')).toBeTruthy();
    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe(safeValue);
  });

  it('keeps fullscreen open when Escape closes the nested link dialog', async () => {
    const { getByTestId, queryByTestId } = await render(
      <EditorHarness initialValue="Отель у вокзала" />,
    );
    const fullscreenModalOf = () => mockEditorModalProps.get('fullscreen');
    const linkModalOf = () => mockEditorModalProps.get('link');

    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    await fireEvent.press(getByTestId('trip-plan-description-add-link'));
    expect(fullscreenModalOf()).toBeDefined();
    expect(linkModalOf()).toBeDefined();
    expect(linkModalOf().visible).toBe(true);

    await act(() => {
      fullscreenModalOf().onRequestClose();
    });
    expect(linkModalOf().visible).toBe(false);
    expect(getByTestId('trip-plan-description-fullscreen')).toBeTruthy();

    await act(() => {
      fullscreenModalOf().onRequestClose();
    });
    expect(queryByTestId('trip-plan-description-fullscreen')).toBeNull();
  });

  it('cancels link insertion without changing the draft and restores its selection', async () => {
    const initialValue = 'Отель у вокзала';
    const selectedStart = initialValue.indexOf('вокзала');
    const selectedEnd = selectedStart + 'вокзала'.length;
    const { getByTestId } = await render(<EditorHarness initialValue={initialValue} />);

    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    await fireEvent(getByTestId('trip-plan-description-fullscreen-input'), 'selectionChange', {
      nativeEvent: { selection: { start: selectedStart, end: selectedEnd } },
    });
    await fireEvent.press(getByTestId('trip-plan-description-add-link'));
    await fireEvent.changeText(getByTestId('trip-plan-description-link-input'), 'example.com/hotel');
    await fireEvent.press(getByTestId('trip-plan-description-link-cancel'));

    const fullscreenInput = getByTestId('trip-plan-description-fullscreen-input');
    expect(fullscreenInput.props.value).toBe(initialValue);
    expect(fullscreenInput.props.selection).toEqual({
      start: selectedStart,
      end: selectedEnd,
    });
  });

  it('keeps native copy/cut/paste behavior and closes Done without a hidden callback', async () => {
    const onChangeText = jest.fn();
    const { getByTestId, queryByTestId } = await render(
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
    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    const fullscreenInput = getByTestId('trip-plan-description-fullscreen-input');
    expect(fullscreenInput.props.contextMenuHidden).toBeUndefined();
    await fireEvent.press(getByTestId('trip-plan-description-done'));

    expect(queryByTestId('trip-plan-description-fullscreen')).toBeNull();
    expect(onChangeText).not.toHaveBeenCalled();
  });

  // #2072: панель оформления ставит и снимает разметку #2070 у выделения поля,
  // под которым стоит, и оставляет выделение на тексте — повторное нажатие
  // снимает оформление.
  it('bold toggles ** around the inline selection and keeps the word selected', async () => {
    const { getByTestId } = await render(<EditorHarness initialValue="Ужин в кафе" />);
    const inlineInput = getByTestId('trip-plan-edit-description');
    await fireEvent(inlineInput, 'selectionChange', { nativeEvent: { selection: { start: 7, end: 11 } } });

    await fireEvent.press(getByTestId('trip-plan-description-format-bold'));
    let updated = getByTestId('trip-plan-edit-description');
    expect(updated.props.value).toBe('Ужин в **кафе**');
    expect(updated.props.selection).toEqual({ start: 9, end: 13 });

    await fireEvent.press(getByTestId('trip-plan-description-format-bold'));
    updated = getByTestId('trip-plan-edit-description');
    expect(updated.props.value).toBe('Ужин в кафе');
  });

  it('list and heading buttons mark the selected lines in fullscreen', async () => {
    const { getByTestId } = await render(<EditorHarness initialValue={'вода\nхлеб'} />);
    await fireEvent.press(getByTestId('trip-plan-description-open-fullscreen'));
    const fullscreenInput = getByTestId('trip-plan-description-fullscreen-input');
    await fireEvent(fullscreenInput, 'selectionChange', { nativeEvent: { selection: { start: 0, end: 9 } } });

    await fireEvent.press(getByTestId('trip-plan-description-fullscreen-format-bullet'));
    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe('- вода\n- хлеб');

    await fireEvent(getByTestId('trip-plan-description-fullscreen-input'), 'selectionChange', {
      nativeEvent: { selection: { start: 2, end: 2 } },
    });
    await fireEvent.press(getByTestId('trip-plan-description-fullscreen-format-heading'));
    expect(getByTestId('trip-plan-description-fullscreen-input').props.value).toBe('## вода\n- хлеб');
  });

  it('format buttons have accessible names, a 44px target and are disabled with the editor', async () => {
    const { getByTestId, rerender } = await render(
      <TripPlanDescriptionEditor value="" onChangeText={jest.fn()} label="Описание" placeholder="" />,
    );
    for (const action of ['heading', 'bullet', 'ordered', 'bold', 'italic']) {
      const button = getByTestId(`trip-plan-description-format-${action}`);
      expect(button.props.accessibilityLabel).toBeTruthy();
      const style = StyleSheet.flatten(
        typeof button.props.style === 'function' ? button.props.style({ pressed: false }) : button.props.style,
      );
      expect(style.minHeight ?? style.height).toBeGreaterThanOrEqual(44);
    }
    expect(getByTestId('trip-plan-description-format-hint')).toBeTruthy();

    await rerender(
      <TripPlanDescriptionEditor value="" onChangeText={jest.fn()} label="Описание" placeholder="" editable={false} />,
    );
    expect(getByTestId('trip-plan-description-format-bold').props.accessibilityState?.disabled).toBe(true);
  });
});

// Observe the public component input while retaining its normal host rendering.
const captureNative = require('react-native')
const capturedOriginalModal = captureNative.Modal
const mockEditorModalProps = new Map<string, any>()
beforeAll(() => {
  captureNative.Modal = require('react').forwardRef((props: any, ref: any) => {
    const key = props.presentationStyle === 'fullScreen' ? 'fullscreen' : props.transparent === true ? 'link' : null
    if (key) mockEditorModalProps.set(key, props)
    return require('react').createElement(capturedOriginalModal, { ...props, ref })
  })
})
afterAll(() => { captureNative.Modal = capturedOriginalModal })
beforeEach(() => { mockEditorModalProps.clear() })
