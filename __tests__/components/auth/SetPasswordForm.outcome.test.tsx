// #2127: смена пароля по ссылке из письма. Слой api больше не показывает Alert
// (на web он пуст) — причину отказа возвращает экрану, и форма показывает её,
// а не общий «Не удалось изменить пароль».
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SetPasswordForm from '@/components/auth/SetPasswordForm';

const mockSetNewPassword = jest.fn();

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ setNewPassword: mockSetNewPassword }),
}));

jest.mock('@/hooks/useSecretLinkParam', () => ({
  useSecretLinkParam: () => 'reset-token',
}));

jest.mock('@/components/seo/LazyInstantSEO', () => () => null);

jest.mock('expo-router', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const PASSWORD = 'StrongPassword1!';

async function submit() {
  const view = render(<SetPasswordForm />);
  fireEvent.changeText(view.getByPlaceholderText('Новый пароль'), PASSWORD);
  fireEvent.changeText(view.getByPlaceholderText('Подтвердите пароль'), PASSWORD);
  fireEvent.press(view.getByLabelText('Сменить пароль'));
  return view;
}

describe('SetPasswordForm — причина отказа из слоя api (#2127)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('показывает причину отказа сервера, а не общий текст', async () => {
    mockSetNewPassword.mockResolvedValueOnce({ ok: false, reason: 'rejected', message: 'Ссылка устарела' });
    const { findByText } = await submit();

    expect(await findByText('Ссылка устарела')).toBeTruthy();
    expect(mockSetNewPassword).toHaveBeenCalledWith('reset-token', PASSWORD);
  });

  it('без причины — общий текст «Не удалось изменить пароль»', async () => {
    mockSetNewPassword.mockResolvedValueOnce({ ok: false, reason: 'unknown', message: '' });
    const { findByText } = await submit();

    expect(await findByText(/Не удалось изменить пароль/)).toBeTruthy();
  });

  it('успех — текст успеха формы', async () => {
    mockSetNewPassword.mockResolvedValueOnce({ ok: true, message: 'Пароль успешно изменен' });
    const { findByText } = await submit();

    await waitFor(async () => expect(await findByText(/успешно изменен/i)).toBeTruthy());
  });
});
