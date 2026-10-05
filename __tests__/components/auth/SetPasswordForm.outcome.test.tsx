// #2127: смена пароля по ссылке из письма. Слой api больше не показывает Alert
// (на web он пуст) — причину отказа возвращает экрану, и форма показывает её,
// а не общий «Не удалось изменить пароль».
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { setNewPasswordApi } from '@/api/auth';
import SetPasswordForm from '@/components/auth/SetPasswordForm';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

const mockSetNewPassword = jest.fn();
const mockNavigate = jest.fn();
let mockToken: string | null = 'reset-token';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ setNewPassword: mockSetNewPassword }),
}));

jest.mock('@/hooks/useSecretLinkParam', () => ({
  useSecretLinkParam: () => mockToken,
}));

jest.mock('@/components/seo/LazyInstantSEO', () => () => null);

jest.mock('expo-router', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true,
}));

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;

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

// #2177: отказ сервера из-за самой ссылки. Мокается только сеть: `setNewPasswordApi`,
// классификация, форма и i18n настоящие. Сервер отвечает строкой-маркером — в форме
// её быть не должно.
describe('SetPasswordForm — недействительная ссылка (#2177)', () => {
  const SERVER_MARKER = 'server-detail-marker-2177';
  const GO_TO_LOGIN = 'Перейти ко входу';

  const serverRejects = (status: number, body: unknown) => {
    mockedFetchWithTimeout.mockResolvedValueOnce({ ok: false, status, text: async () => JSON.stringify(body) } as any);
    mockSetNewPassword.mockImplementationOnce(setNewPasswordApi);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetNewPassword.mockReset();
    mockToken = 'reset-token';
  });

  it('400 {detail} — текст про ссылку и кнопка «Перейти ко входу», нажатие ведёт на вход', async () => {
    serverRejects(400, { detail: SERVER_MARKER });
    const view = await submit();

    expect(
      await view.findByText('Ссылка недействительна или устарела. Запросите новую: на экране входа нажмите «Забыли пароль?»'),
    ).toBeTruthy();
    expect(view.queryByText(new RegExp(SERVER_MARKER))).toBeNull();

    fireEvent.press(view.getByLabelText(GO_TO_LOGIN));
    expect(mockNavigate).toHaveBeenCalledWith('login');
  });

  it('400 {password: […]} — прежний общий текст без кнопки входа', async () => {
    serverRejects(400, { password: [SERVER_MARKER] });
    const view = await submit();

    expect(await view.findByText('Не удалось изменить пароль')).toBeTruthy();
    expect(view.queryByLabelText(GO_TO_LOGIN)).toBeNull();
    expect(view.queryByText(new RegExp(SERVER_MARKER))).toBeNull();
  });

  it('без токена в ссылке — под «Ссылка недействительна» та же кнопка входа', () => {
    mockToken = '';
    const view = render(<SetPasswordForm />);

    expect(view.getByText('Ссылка недействительна или устарела')).toBeTruthy();
    fireEvent.press(view.getByLabelText(GO_TO_LOGIN));
    expect(mockNavigate).toHaveBeenCalledWith('login');
  });

  it('до гидратации токен ещё не прочитан (#2178) — ни текста про ссылку, ни кнопки', () => {
    mockToken = null;
    const view = render(<SetPasswordForm />);

    expect(view.queryByText('Ссылка недействительна или устарела')).toBeNull();
    expect(view.queryByLabelText(GO_TO_LOGIN)).toBeNull();
  });
});
