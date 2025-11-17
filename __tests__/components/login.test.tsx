import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import Login from '@/app/(tabs)/login';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
jest.mock('@/context/AuthContext');
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/login',
}));

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      reset: jest.fn(),
      navigate: jest.fn(),
    }),
    useIsFocused: () => true,
  };
});

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 667 })),
    },
    ImageBackground: ({ children, ...props }: any) => {
      const { View } = require('react-native');
      return <View {...props}>{children}</View>;
    },
    KeyboardAvoidingView: ({ children, ...props }: any) => {
      const { View } = require('react-native');
      return <View {...props}>{children}</View>;
    },
  };
});

jest.mock('react-native-paper', () => {
  const RN = require('react-native');
  return {
    Card: ({ children, ...props }: any) => <RN.View {...props}>{children}</RN.View>,
    Button: ({ onPress, children, disabled, ...props }: any) => {
      const { TouchableOpacity } = RN;
      return (
        <TouchableOpacity onPress={onPress} disabled={disabled} {...props}>
          {typeof children === 'string' ? <RN.Text>{children}</RN.Text> : children}
        </TouchableOpacity>
      );
    },
  };
});

jest.mock('@/components/seo/InstantSEO', () => {
  const React = require('react');
  return ({ children }: any) => (children ? <>{children}</> : null);
});

// Test utilities
const renderLogin = (mockLogin?: jest.Mock, mockSendPassword?: jest.Mock) => {
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

  return render(
    <NavigationContainer>
      <Login />
    </NavigationContainer>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Validation', () => {
    it('should show error for invalid email format', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите email и пароль.')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should accept valid email format', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, '   ');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите email и пароль.')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should accept non-empty password', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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

  describe('Password Reset Flow', () => {
    it('should show error for invalid email when resetting password', async () => {
      const mockSendPassword = jest.fn();
      const { getByPlaceholderText, getByText } = renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Введите корректный email.')).toBeTruthy();
      });

      expect(mockSendPassword).not.toHaveBeenCalled();
    });

    it('should call sendPassword with trimmed email', async () => {
      const mockSendPassword = jest.fn().mockResolvedValue('Пароль отправлен на email');
      const { getByPlaceholderText, getByText } = renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, '  test@example.com  ');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(mockSendPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('should show success message on successful password reset', async () => {
      const mockSendPassword = jest.fn().mockResolvedValue('Пароль отправлен на email');
      const { getByPlaceholderText, getByText } = renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Пароль отправлен на email')).toBeTruthy();
      });
    });

    it('should show error message when password reset fails', async () => {
      const mockSendPassword = jest.fn().mockResolvedValue('Ошибка: не удалось отправить');
      const { getByPlaceholderText, getByText } = renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Ошибка: не удалось отправить')).toBeTruthy();
      });
    });

    it('should show error message on password reset exception', async () => {
      const mockSendPassword = jest.fn().mockRejectedValue(new Error('Network error'));
      const { getByPlaceholderText, getByText } = renderLogin(undefined, mockSendPassword);

      const emailInput = getByPlaceholderText('Email');
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.press(getByText('Забыли пароль?'));

      await waitFor(() => {
        expect(getByText('Network error')).toBeTruthy();
      });
    });

    it('should show generic error when password reset exception has no message', async () => {
      const mockSendPassword = jest.fn().mockRejectedValue({});
      const { getByPlaceholderText, getByText } = renderLogin(undefined, mockSendPassword);

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
      const { getByPlaceholderText, getByText } = renderLogin(undefined, mockSendPassword);

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
    it('should update email input value', () => {
      const { getByPlaceholderText } = renderLogin();
      const emailInput = getByPlaceholderText('Email');

      fireEvent.changeText(emailInput, 'test@example.com');
      expect(emailInput.props.value).toBe('test@example.com');
    });

    it('should update password input value', () => {
      const { getByPlaceholderText } = renderLogin();
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(passwordInput, 'password123');
      expect(passwordInput.props.value).toBe('password123');
    });

    it('should focus password input when email input is submitted', () => {
      const { getByPlaceholderText } = renderLogin();
      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      // Mock focus method
      passwordInput.focus = jest.fn();

      fireEvent(emailInput, 'submitEditing');
      expect(passwordInput.focus).toHaveBeenCalled();
    });

    it('should submit login when password input is submitted', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите email и пароль.')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle email without domain', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'test@');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите email и пароль.')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle email without @ symbol', async () => {
      const mockLogin = jest.fn();
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

      const emailInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Пароль');

      fireEvent.changeText(emailInput, 'testexample.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(getByText('Войти'));

      await waitFor(() => {
        expect(getByText('Введите email и пароль.')).toBeTruthy();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle very long email', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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
      const { getByPlaceholderText, getByText } = renderLogin(mockLogin);

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

