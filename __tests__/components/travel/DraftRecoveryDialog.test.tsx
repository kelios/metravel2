import { fireEvent, render } from '@testing-library/react-native';
import { Modal } from 'react-native';

import DraftRecoveryDialog from '@/components/travel/DraftRecoveryDialog';

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    overlay: 'rgba(0,0,0,0.5)',
    surface: '#ffffff',
    surfaceMuted: '#f3f4f6',
    primary: '#2f7d68',
    primarySoft: '#e8f3ef',
    text: '#111827',
    textMuted: '#6b7280',
    textOnPrimary: '#ffffff',
    border: '#d1d5db',
    boxShadows: {
      light: '0 1px 2px rgba(0,0,0,0.08)',
      medium: '0 2px 8px rgba(0,0,0,0.12)',
    },
  }),
}));

describe('DraftRecoveryDialog', () => {
  it('makes the saved-version choice explicit', () => {
    const { getByText, getByLabelText } = render(
      <DraftRecoveryDialog
        visible
        draftTimestamp={Date.now() - 60_000}
        onRecover={jest.fn()}
        onDiscard={jest.fn()}
      />,
    );

    expect(getByText('Есть несохранённые изменения')).toBeTruthy();
    expect(getByText(/локальный черновик этого путешествия/i)).toBeTruthy();
    expect(getByLabelText('Открыть сохранённую версию')).toBeTruthy();
    expect(getByLabelText('Продолжить с локального черновика')).toBeTruthy();
  });

  it('routes actions to discard and recover handlers', () => {
    const onRecover = jest.fn();
    const onDiscard = jest.fn();
    const { getByLabelText } = render(
      <DraftRecoveryDialog
        visible
        draftTimestamp={Date.now() - 60_000}
        onRecover={onRecover}
        onDiscard={onDiscard}
      />,
    );

    fireEvent.press(getByLabelText('Открыть сохранённую версию'));
    fireEvent.press(getByLabelText('Продолжить с локального черновика'));

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it('does not discard the only local draft on Android hardware Back', () => {
    const onDiscard = jest.fn();
    const screen = render(
      <DraftRecoveryDialog
        visible
        draftTimestamp={Date.now() - 60_000}
        onRecover={jest.fn()}
        onDiscard={onDiscard}
      />,
    );

    screen.UNSAFE_getByType(Modal).props.onRequestClose();

    expect(onDiscard).not.toHaveBeenCalled();
  });
});
