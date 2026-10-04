// #2142: a successful cold start reads as one launch screen — the gate shows
// the launch cover while deciding/prompting, the lock screen only on refusal,
// and holds the native splash until it has decided.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { translate as i18nT } from '@/i18n';
import {
  resetLaunchReadinessForTests,
  useLaunchReadinessStore,
} from '@/stores/launchReadinessStore';

const mockAuthenticate = jest.fn<Promise<boolean>, [string?]>();
const mockLogout = jest.fn();
let mockAuth = { isAuthenticated: true, authReady: true, logout: mockLogout };
let mockBiometric = {
  isAvailable: true,
  isEnrolled: true,
  isEnabled: true,
  isChecking: false,
  authenticate: (message?: string) => mockAuthenticate(message),
};

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('@/hooks/useBiometricAuth', () => ({
  useBiometricAuth: () => mockBiometric,
}));

import BiometricGate from '@/components/layout/BiometricGate.native';

const LOCKED_TITLE = i18nT('navigation:components.layout.BiometricGate.metravel_zablokirovan_8dcb0074');
const UNLOCK_LABEL = i18nT('navigation:components.layout.BiometricGate.razblokirovat_f1634eec');
// The cover is decorative and hidden from assistive tech, like the native splash.
const HIDDEN = { includeHiddenElements: true };
const gateSettled = () => useLaunchReadinessStore.getState().ready.biometricGate;

function deferred() {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('BiometricGate (native)', () => {
  beforeEach(() => {
    resetLaunchReadinessForTests();
    mockAuthenticate.mockReset();
    mockLogout.mockReset();
    mockAuth = { isAuthenticated: true, authReady: true, logout: mockLogout };
    mockBiometric = { ...mockBiometric, isAvailable: true, isEnrolled: true, isEnabled: true, isChecking: false };
  });

  it('shows the launch cover, not «заблокирован», while the Face ID prompt is open', async () => {
    const prompt = deferred();
    mockAuthenticate.mockReturnValue(prompt.promise);
    render(<BiometricGate />);

    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('launch-cover', HIDDEN)).toBeTruthy();
    expect(screen.queryByText(LOCKED_TITLE)).toBeNull();
    expect(gateSettled()).toBe(false);

    await act(async () => { prompt.resolve(true); });
    expect(screen.queryByTestId('launch-cover', HIDDEN)).toBeNull();
    expect(screen.queryByText(LOCKED_TITLE)).toBeNull();
    expect(gateSettled()).toBe(true);
  });

  it('shows the lock screen with retry after a cancelled prompt', async () => {
    mockAuthenticate.mockResolvedValueOnce(false);
    render(<BiometricGate />);

    expect(await screen.findByText(LOCKED_TITLE)).toBeTruthy();
    expect(gateSettled()).toBe(true);

    const retry = deferred();
    mockAuthenticate.mockReturnValueOnce(retry.promise);
    await act(async () => { fireEvent.press(screen.getByText(UNLOCK_LABEL)); });
    // Retry: the system prompt runs over the cover again, never over the lock text.
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
    await act(async () => { retry.resolve(true); });
    expect(screen.queryByText(LOCKED_TITLE)).toBeNull();
  });

  it('holds the cover and the splash while auth restore or the device probe is running', () => {
    mockAuth = { ...mockAuth, authReady: false, isAuthenticated: false };
    mockBiometric = { ...mockBiometric, isEnabled: false, isChecking: true };
    render(<BiometricGate />);

    expect(screen.getByTestId('launch-cover', HIDDEN)).toBeTruthy();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(gateSettled()).toBe(false);
  });

  it('opens without a prompt when biometrics are off and releases the splash', async () => {
    mockBiometric = { ...mockBiometric, isEnabled: false };
    render(<BiometricGate />);

    await waitFor(() => expect(gateSettled()).toBe(true));
    expect(screen.queryByTestId('launch-cover', HIDDEN)).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('a guest start opens without a prompt', async () => {
    mockAuth = { ...mockAuth, isAuthenticated: false };
    render(<BiometricGate />);

    await waitFor(() => expect(gateSettled()).toBe(true));
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('the launch failsafe opens a gate whose probe hangs (fail-open, as before)', async () => {
    mockBiometric = { ...mockBiometric, isEnabled: false, isChecking: true };
    render(<BiometricGate />);
    expect(screen.getByTestId('launch-cover', HIDDEN)).toBeTruthy();

    act(() => { useLaunchReadinessStore.getState().expireLaunchFailsafe(); });
    await waitFor(() => expect(screen.queryByTestId('launch-cover', HIDDEN)).toBeNull());
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('a probe that settles after the failsafe still prompts (the failsafe does not consume the decision)', async () => {
    mockAuth = { ...mockAuth, authReady: false, isAuthenticated: false };
    mockBiometric = { ...mockBiometric, isEnabled: false, isChecking: true };
    const prompt = deferred();
    mockAuthenticate.mockReturnValue(prompt.promise);
    const view = render(<BiometricGate />);

    act(() => { useLaunchReadinessStore.getState().expireLaunchFailsafe(); });
    await waitFor(() => expect(screen.queryByTestId('launch-cover', HIDDEN)).toBeNull());

    mockAuth = { ...mockAuth, authReady: true, isAuthenticated: true };
    mockBiometric = { ...mockBiometric, isEnabled: true, isChecking: false };
    view.rerender(<BiometricGate />);
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('launch-cover', HIDDEN)).toBeTruthy();

    await act(async () => { prompt.resolve(true); });
    expect(screen.queryByTestId('launch-cover', HIDDEN)).toBeNull();
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('decides once per cold start: a later sign-in does not prompt', async () => {
    mockAuth = { ...mockAuth, isAuthenticated: false };
    const view = render(<BiometricGate />);
    await waitFor(() => expect(gateSettled()).toBe(true));

    mockAuth = { ...mockAuth, isAuthenticated: true };
    view.rerender(<BiometricGate />);
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('launch-cover', HIDDEN)).toBeNull();
  });
});
