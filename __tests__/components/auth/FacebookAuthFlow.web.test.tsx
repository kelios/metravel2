import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import FacebookAuthFlow from '@/components/auth/FacebookAuthFlow.web';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/context/AuthContext');

let mockEmailPermissionGranted = false;

jest.mock('@/components/auth/FacebookSignInButton', () => ({
  __esModule: true,
  default: ({ onSuccess, onError, onCancel, mode = 'sign_in', disabled }: any) => (
    <View>
      <Pressable
        testID={`mock-facebook-${mode}`}
        disabled={disabled}
        onPress={() => onSuccess({
          accessToken: mode === 'rerequest_email' ? 'fresh-rerequest-token' : 'fresh-login-token',
          grantedScopes: mockEmailPermissionGranted ? ['public_profile', 'email'] : ['public_profile'],
          emailPermissionGranted: mockEmailPermissionGranted,
        })}
      >
        <Text>{mode}</Text>
      </Pressable>
      <Pressable testID={`mock-facebook-error-${mode}`} onPress={() => onError?.('Provider failed')}>
        <Text>provider error</Text>
      </Pressable>
      <Pressable testID={`mock-facebook-cancel-${mode}`} onPress={onCancel}>
        <Text>provider cancel</Text>
      </Pressable>
    </View>
  ),
}));

const loginWithFacebook = jest.fn();
const startFacebookEmailCompletion = jest.fn();
const confirmFacebookEmailCompletion = jest.fn();

describe('FacebookAuthFlow web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailPermissionGranted = false;
    (useAuth as jest.Mock).mockReturnValue({
      loginWithFacebook,
      startFacebookEmailCompletion,
      confirmFacebookEmailCompletion,
    });
  });

  it('submits a fresh token immediately when the email scope is granted', async () => {
    mockEmailPermissionGranted = true;
    loginWithFacebook.mockResolvedValue({
      status: 'authenticated',
      user: {
        token: 'server-session-token',
        id: 19,
        name: 'Facebook User',
        email: 'user@example.com',
        is_superuser: false,
      },
    });
    const onAuthenticated = jest.fn();
    const screen = render(<FacebookAuthFlow onAuthenticated={onAuthenticated} />);

    fireEvent.press(screen.getByTestId('mock-facebook-sign_in'));

    await waitFor(() => {
      expect(loginWithFacebook).toHaveBeenCalledWith('fresh-login-token');
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('does not send a token when email permission is initially missing and rerequests only on click', async () => {
    loginWithFacebook.mockResolvedValue({
      status: 'email_completion_required',
      completionHandle: 'opaque-handle',
      reasonCode: 'facebook_email_permission_missing',
      expiresIn: 900,
    });
    const screen = render(<FacebookAuthFlow onAuthenticated={jest.fn()} />);

    fireEvent.press(screen.getByTestId('mock-facebook-sign_in'));

    expect(loginWithFacebook).not.toHaveBeenCalled();
    expect(screen.getByTestId('facebook-permission-panel')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mock-facebook-rerequest_email'));

    await waitFor(() => {
      expect(loginWithFacebook).toHaveBeenCalledWith('fresh-rerequest-token');
      expect(screen.getByTestId('facebook-email-completion-panel')).toBeTruthy();
    });
  });

  it('sends an email code and authenticates only after confirmation', async () => {
    loginWithFacebook.mockResolvedValue({
      status: 'email_completion_required',
      completionHandle: 'opaque-handle',
      reasonCode: 'facebook_primary_email_unavailable',
      expiresIn: 900,
    });
    startFacebookEmailCompletion.mockResolvedValue({ status: 'verification_sent' });
    confirmFacebookEmailCompletion.mockResolvedValue({
      status: 'authenticated',
      user: {
        token: 'server-session-token',
        id: 19,
        name: 'Facebook User',
        email: 'user@example.com',
        is_superuser: false,
      },
    });
    const onAuthenticated = jest.fn();
    const screen = render(<FacebookAuthFlow onAuthenticated={onAuthenticated} />);

    // Simulate a provider callback with email permission so the backend is called immediately.
    const initialButton = screen.getByTestId('mock-facebook-sign_in');
    fireEvent(initialButton, 'press');
    // The shared mock intentionally omits email; use the explicit retry path to obtain completion.
    fireEvent.press(screen.getByTestId('mock-facebook-rerequest_email'));

    await screen.findByTestId('facebook-completion-email');
    fireEvent.changeText(screen.getByTestId('facebook-completion-email'), ' user@example.com ');
    fireEvent.press(screen.getByTestId('facebook-completion-send-code'));

    await waitFor(() => {
      expect(startFacebookEmailCompletion).toHaveBeenCalledWith('opaque-handle', 'user@example.com');
      expect(screen.getByTestId('facebook-completion-code')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByTestId('facebook-completion-code'), '123456');
    fireEvent.press(screen.getByTestId('facebook-completion-confirm'));

    await waitFor(() => {
      expect(confirmFacebookEmailCompletion).toHaveBeenCalledWith('opaque-handle', '123456');
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('renders provider and API failures in the inline alert region', async () => {
    const onFailure = jest.fn();
    const providerScreen = render(
      <FacebookAuthFlow onAuthenticated={jest.fn()} onFailure={onFailure} />,
    );

    fireEvent.press(providerScreen.getByTestId('mock-facebook-error-sign_in'));

    expect(providerScreen.getByTestId('facebook-auth-error').props.children).toBe('Provider failed');
    expect(onFailure).toHaveBeenCalledWith('provider');
    providerScreen.unmount();

    mockEmailPermissionGranted = true;
    loginWithFacebook.mockResolvedValue({
      status: 'error',
      errorCode: 'facebook_token_invalid',
      message: 'API failed',
    });
    const apiScreen = render(
      <FacebookAuthFlow onAuthenticated={jest.fn()} onFailure={onFailure} />,
    );

    fireEvent.press(apiScreen.getByTestId('mock-facebook-sign_in'));

    await waitFor(() => {
      expect(apiScreen.getByTestId('facebook-auth-error').props.children).toBe('API failed');
      expect(onFailure).toHaveBeenCalledWith('facebook_token_invalid');
    });
  });

  it('cancels a missing-permission flow without sending the access token', () => {
    const screen = render(<FacebookAuthFlow onAuthenticated={jest.fn()} />);

    fireEvent.press(screen.getByTestId('mock-facebook-sign_in'));
    fireEvent.press(screen.getByTestId('facebook-permission-cancel'));

    expect(loginWithFacebook).not.toHaveBeenCalled();
    expect(screen.queryByTestId('facebook-permission-panel')).toBeNull();
    expect(screen.getByTestId('mock-facebook-sign_in')).toBeTruthy();
  });

  it('clears an invalid completion handle and returns to a fresh login', async () => {
    loginWithFacebook.mockResolvedValue({
      status: 'email_completion_required',
      completionHandle: 'opaque-handle',
      reasonCode: 'facebook_primary_email_unavailable',
      expiresIn: 900,
    });
    startFacebookEmailCompletion.mockResolvedValue({
      status: 'error',
      errorCode: 'facebook_completion_invalid',
      message: 'Completion expired',
    });
    const screen = render(<FacebookAuthFlow onAuthenticated={jest.fn()} />);

    fireEvent.press(screen.getByTestId('mock-facebook-sign_in'));
    fireEvent.press(screen.getByTestId('mock-facebook-rerequest_email'));
    await screen.findByTestId('facebook-completion-email');
    fireEvent.changeText(screen.getByTestId('facebook-completion-email'), 'user@example.com');
    fireEvent.press(screen.getByTestId('facebook-completion-send-code'));

    await waitFor(() => {
      expect(screen.queryByTestId('facebook-email-completion-panel')).toBeNull();
      expect(screen.getByTestId('mock-facebook-sign_in')).toBeTruthy();
      expect(screen.getByTestId('facebook-auth-error').props.children).toBe('Completion expired');
    });
  });

  it('expires an unused completion handle in component memory', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-16T12:00:00Z'));
    try {
      loginWithFacebook.mockResolvedValue({
        status: 'email_completion_required',
        completionHandle: 'opaque-handle',
        reasonCode: 'facebook_primary_email_unavailable',
        expiresIn: 1,
      });
      const screen = render(<FacebookAuthFlow onAuthenticated={jest.fn()} />);

      fireEvent.press(screen.getByTestId('mock-facebook-sign_in'));
      await act(async () => {
        fireEvent.press(screen.getByTestId('mock-facebook-rerequest_email'));
        await Promise.resolve();
      });
      expect(screen.getByTestId('facebook-email-completion-panel')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1001);
      });

      expect(screen.queryByTestId('facebook-email-completion-panel')).toBeNull();
      expect(screen.getByTestId('facebook-auth-error')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports busy state so sibling authentication actions stay disabled', async () => {
    mockEmailPermissionGranted = true;
    let resolveLogin!: (result: any) => void;
    loginWithFacebook.mockImplementation(() => new Promise((resolve) => {
      resolveLogin = resolve;
    }));
    const onBusyChange = jest.fn();
    const screen = render(
      <FacebookAuthFlow onAuthenticated={jest.fn()} onBusyChange={onBusyChange} />,
    );

    fireEvent.press(screen.getByTestId('mock-facebook-sign_in'));

    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));

    await act(async () => {
      resolveLogin({
        status: 'error',
        errorCode: 'facebook_token_invalid',
        message: 'API failed',
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });
});
