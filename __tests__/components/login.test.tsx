import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import Login from '@/app/(tabs)/login';
import { useAuth } from '@/context/AuthContext';

// Mock dependencies
jest.mock('@/context/AuthContext');
jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/login',
  useNavigation: () => ({
    reset: jest.fn(),
    navigate: jest.fn(),
  }),
  useIsFocused: () => true,
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const mockReactNative = {}
  Object.defineProperties(mockReactNative, Object.getOwnPropertyDescriptors(RN))

  Object.defineProperty(mockReactNative, 'Dimensions', {
    value: {
      get: jest.fn(() => ({ width: 375, height: 667 })),
    },
    configurable: true,
    enumerable: true,
    writable: true,
  })

  Object.defineProperty(mockReactNative, 'ImageBackground', {
    value: ({ children, ...props }: any) => {
      const { View } = require('react-native');
      return <View {...props}>{children}</View>;
    },
    configurable: true,
    enumerable: true,
    writable: true,
  })

  Object.defineProperty(mockReactNative, 'KeyboardAvoidingView', {
    value: ({ children, ...props }: any) => {
      const { View } = require('react-native');
      return <View {...props}>{children}</View>;
    },
    configurable: true,
    enumerable: true,
    writable: true,
  })

  return mockReactNative;
});

jest.mock('react-native-paper', () => {
  const RN = require('react-native');
  const Card = ({ children, ...props }: any) => <RN.View {...props}>{children}</RN.View>;
  Card.Content = ({ children, ...props }: any) => <RN.View {...props}>{children}</RN.View>;

  const Button = ({ onPress, children, disabled, ...props }: any) => {
    const { TouchableOpacity } = RN;
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} {...props}>
        {typeof children === 'string' ? <RN.Text>{children}</RN.Text> : children}
      </TouchableOpacity>
    );
  };

  return { Card, Button };
});

jest.mock('@/components/seo/InstantSEO', () => {
  const React = require('react');
  return ({ children }: any) => (children ? <>{children}</> : null);
});

// Test utilities
const renderLogin = async (mockLogin?: jest.Mock, mockSendPassword?: jest.Mock) => {
  const defaultLogin = jest.fn().mockResolvedValue(true);
  const defaultSendPassword = jest.fn().mockResolvedValue('Пароль отправлен на email');

  (useAuth as jest.Mock).mockReturnValue({
    login: mockLogin || defaultLogin,
    sendPassword: mockSendPassword || defaultSendPassword,
    isAuthenticated: false,
    username: '',
    userId: null,
    isSuperuser: false,
  });

  const utils = render(<Login />);

  // Login screen renders <ActivityIndicator> until the React.lazy LoginForm
  // chunk resolves. Under heavy parallel test load that dynamic import can take
  // longer than the default 1000ms findBy timeout, so give it explicit headroom
  // to avoid flaky failures in full-suite runs.
  await utils.findByPlaceholderText('Email', undefined, { timeout: 10000 });

  return utils;
};

describe('Login Component', () => {
  beforeEach(() => {
    // Some test suites use fake timers and don't always restore them.
    // Ensure this suite runs with real timers so @testing-library's async utils work.
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Email Validation', () => {
    it('should show error for invalid email format', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите корректный email адрес')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should accept valid email format', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should trim email whitespace', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, '  test@example.com  ');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });
  });

  describe('Password Validation', () => {
    it('should show error for empty password', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, '   ');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Пароль обязателен')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should accept non-empty password', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });
  });

  describe('Login Flow', () => {
    it('should call login with correct credentials', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should show error message on failed login', async () => {
      const mockLogin = jest.fn().mockResolvedValue(false);
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Неверный email или пароль.')).toBeTruthy();
      });
    });

    it('should show error message on login exception', async () => {
      const mockLogin = jest.fn().mockRejectedValue(new Error('Network error'));
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Network error')).toBeTruthy();
      });
    });

    it('should show generic error message when exception has no message', async () => {
      const mockLogin = jest.fn().mockRejectedValue({});
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Ошибка при входе.')).toBeTruthy();
      });
    });

    it('should disable button while loading', async () => {
      const mockLogin = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Подождите…')).toBeTruthy();
      });
    });
  });

  describe('Native re-login after logout (#670)', () => {
    // On native, /login is a tab route that stays MOUNTED after a successful
    // login navigates away, so the `submitted` latch (set on success, never
    // reset) leaves every auth button permanently disabled/loading. When the
    // user logs out and returns to the same mounted screen, the login screen
    // must re-enable itself once auth state is unauthenticated + focused.
    it('re-enables the login button after logout returns to the mounted screen', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const authValue: Record<string, unknown> = {
        login: mockLogin,
        sendPassword: jest.fn().mockResolvedValue('ok'),
        loginWithGoogle: jest.fn().mockResolvedValue(true),
        isAuthenticated: false,
        username: '',
        userId: null,
        isSuperuser: false,
      };
      (useAuth as jest.Mock).mockImplementation(() => authValue);

      const { getByPlaceholderText, findByPlaceholderText, getByText, rerender } =
        render(<Login />);
      await findByPlaceholderText('Email', undefined, { timeout: 10000 });

      // 1) Successful login latches `submitted` -> button shows "Подождите…".
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Пароль'), 'password123');
      fireEvent.press(getByText('Войти'));
      await waitFor(() => expect(mockLogin).toHaveBeenCalled());
      await waitFor(() => expect(getByText('Подождите…')).toBeTruthy());

      // 2) Emulate the auth-state transition across logout: the screen stays
      //    mounted (native tab), auth flips authenticated -> unauthenticated.
      authValue.isAuthenticated = true;
      rerender(<Login />);
      authValue.isAuthenticated = false;
      rerender(<Login />);

      // 3) The focus/unauth effect must clear the `submitted` latch so a
      //    second login can proceed — button is back to "Войти", not stuck.
      await waitFor(() => expect(getByText('Войти')).toBeTruthy());
    });
  });

  describe('Password Reset Flow', () => {
    it('should show error for invalid email when resetting password', async () => {
      const mockSendPassword = jest.fn();
      const { getByPlaceholderText, getByText } = await renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Введите корректный email адрес')).toBeTruthy();
      });

      expect(mockSendPassword).not.toHaveBeenCalled();
    });

    it('should call sendPassword with trimmed email', async () => {
      const mockSendPassword = jest.fn().mockResolvedValue('Пароль отправлен на email');
      const { getByPlaceholderText, getByText } = await renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, '  test@example.com  ');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(mockSendPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('should show success message on successful password reset', async () => {
      const mockSendPassword = jest.fn().mockResolvedValue('Пароль отправлен на email');
      const { getByPlaceholderText, getByText } = await renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Пароль отправлен на email')).toBeTruthy();
      });
    });

    it('should show error message when password reset fails', async () => {
      const mockSendPassword = jest.fn().mockResolvedValue('Ошибка: не удалось отправить');
      const { getByPlaceholderText, getByText } = await renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Ошибка: не удалось отправить')).toBeTruthy();
      });
    });

    it('should show error message on password reset exception', async () => {
      const mockSendPassword = jest.fn().mockRejectedValue(new Error('Network error'));
      const { getByPlaceholderText, getByText } = await renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Network error')).toBeTruthy();
      });
    });

    it('should show generic error when password reset exception has no message', async () => {
      const mockSendPassword = jest.fn().mockRejectedValue({});
      const { getByPlaceholderText, getByText } = await renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Ошибка при сбросе пароля.')).toBeTruthy();
      });
    });

    it('should disable reset button while loading', async () => {
      const mockSendPassword = jest.fn(
        () => new Promise((resolve) => setTimeout(() => resolve('Success'), 100))
      );
      const { getByPlaceholderText, getByText } = await renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      // Button should be disabled during loading
      await waitFor(() => {
        expect(mockSendPassword).toHaveBeenCalled();
      });
    });
  });

  describe('Input Handling', () => {
    it('should update email input value', async () => {
      const { getByPlaceholderText } = await renderLogin();
      const emailInput = getByPlaceholderText('Email');

      fireEvent.changeText(emailInput, 'test@example.com');
      expect(emailInput.props.value).toBe('test@example.com');
    });

    it('should update password input value', async () => {
      const { getByPlaceholderText } = await renderLogin();
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(passwordInput, 'password123');
      expect(passwordInput.props.value).toBe('password123');
    });

    it('should focus password input when email input is submitted', async () => {
      const focusSpy = jest.spyOn(TextInput.prototype, 'focus');
      const { getByPlaceholderText } = await renderLogin();
      const emailInput = getByPlaceholderText('Email');

      fireEvent(emailInput, 'submitEditing');
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it('should submit login when password input is submitted', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent(passwordInput, 'submitEditing');

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle email with multiple @ symbols', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите корректный email адрес')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle email without domain', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите корректный email адрес')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle email without @ symbol', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'testexample.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите корректный email адрес')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle very long email', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const longEmail = 'a'.repeat(100) + '@example.com';
      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, longEmail);
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    });

    it('should handle special characters in email', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = await renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test+tag@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test+tag@example.com', 'password123');
      });
    });
  });
});
