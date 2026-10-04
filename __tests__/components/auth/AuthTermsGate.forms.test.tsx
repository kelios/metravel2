import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import LoginForm from '@/components/auth/LoginForm';
import RegistrationForm from '@/components/auth/RegistrationForm';
import { useAuth } from '@/context/AuthContext';

// #2132 (Apple 1.2): до согласия с условиями ни один способ входа или
// регистрации не работает, а версия условий уходит серверу только после галки.

const providerProps: Record<string, { disabled?: boolean; termsVersion?: string; onSuccess?: (v: unknown) => void }> = {};

jest.mock('@/context/AuthContext');
jest.mock('@/api/auth', () => ({
  registration: jest.fn().mockResolvedValue({ ok: true, message: 'ok' }),
}));
jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/login',
  useIsFocused: () => true,
}));
jest.mock('@/components/seo/LazyInstantSEO', () => () => null);
jest.mock('@/components/auth/AppleSignInButton', () => {
  const { Pressable } = require('react-native');
  return (props: any) => {
    providerProps.apple = props;
    return (
      <Pressable
        testID="mock-apple"
        disabled={props.disabled}
        onPress={() => props.onSuccess({ identityToken: 'apple-token' })}
      />
    );
  };
});
jest.mock('@/components/auth/GoogleSignInButton', () => {
  const { Pressable } = require('react-native');
  return (props: any) => {
    providerProps.google = props;
    return <Pressable testID="mock-google" disabled={props.disabled} onPress={() => props.onSuccess('google-id-token')} />;
  };
});
jest.mock('@/components/auth/FacebookAuthFlow', () => (props: any) => {
  providerProps.facebook = props;
  return null;
});

const { registration } = jest.requireMock('@/api/auth') as { registration: jest.Mock };

const authValue = {
  login: jest.fn().mockResolvedValue({ ok: false, reason: 'rejected', message: 'nope' }),
  loginWithGoogle: jest.fn().mockResolvedValue({ ok: false, reason: 'rejected', message: 'nope' }),
  loginWithApple: jest.fn().mockResolvedValue({ status: 'error', message: 'nope' }),
  sendPassword: jest.fn(),
  isAuthenticated: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue(authValue);
});

const forms = [
  { name: 'LoginForm', Component: LoginForm, submitLabel: 'Войти' },
  { name: 'RegistrationForm', Component: RegistrationForm, submitLabel: 'Зарегистрироваться' },
] as const;

describe.each(forms)('$name: согласие с условиями до входа (#2132)', ({ Component, submitLabel }) => {
  it('без галки все провайдеры и кнопка формы неактивны, Apple при этом показан', async () => {
    const screen = render(<Component />);

    expect(await screen.findByTestId('auth-terms-gate-checkbox')).toBeTruthy();
    expect(screen.getByTestId('auth-terms-gate-hint')).toBeTruthy();
    expect(screen.getByTestId('mock-apple')).toBeTruthy();
    expect(providerProps.apple.disabled).toBe(true);
    expect(providerProps.google.disabled).toBe(true);
    expect(providerProps.facebook.disabled).toBe(true);
    expect(providerProps.facebook.termsVersion).toBeUndefined();
    expect(screen.getByRole('button', { name: submitLabel }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('после галки провайдеры активны и получают версию условий', async () => {
    const screen = render(<Component />);
    fireEvent.press(await screen.findByTestId('auth-terms-gate-checkbox'));

    expect(screen.queryByTestId('auth-terms-gate-hint')).toBeNull();
    expect(providerProps.apple.disabled).toBe(false);
    expect(providerProps.google.disabled).toBe(false);
    expect(providerProps.facebook.disabled).toBe(false);
    expect(providerProps.facebook.termsVersion).toBe('1');

    fireEvent.press(screen.getByTestId('mock-google'));
    await waitFor(() => expect(authValue.loginWithGoogle).toHaveBeenCalledWith('google-id-token', '1'));
    fireEvent.press(screen.getByTestId('mock-apple'));
    await waitFor(() =>
      expect(authValue.loginWithApple).toHaveBeenCalledWith({ identityToken: 'apple-token' }, '1'),
    );
  });
});

it('RegistrationForm: регистрация по email уходит с terms_version', async () => {
  const screen = render(<RegistrationForm />);
  fireEvent.press(await screen.findByTestId('auth-terms-gate-checkbox'));
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'new@example.com');
  fireEvent.changeText(screen.getAllByPlaceholderText(/Пароль|пароль/)[0], 'Str0ngPass!word');
  fireEvent.press(screen.getByRole('button', { name: 'Зарегистрироваться' }));

  await waitFor(() =>
    expect(registration).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }), '1'),
  );
});
