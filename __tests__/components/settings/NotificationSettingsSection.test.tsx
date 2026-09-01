import { act, fireEvent, render } from '@testing-library/react-native';

const mockRequestAndRegister = jest.fn();
const mockRetryPending = jest.fn();
const mockSyncPushRegistration = jest.fn();
const mockOpenSystemSettings = jest.fn();
const mockActivatePushRegistrationSession = jest.fn();
let mockResult = {
  status: 'notDetermined',
  permission: 'notDetermined',
  token: null,
  backendSynced: false,
};

jest.mock('@/i18n/LocaleProvider', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/services/pushRegistration.native', () => ({
  activatePushRegistrationSession: (...args: unknown[]) =>
    mockActivatePushRegistrationSession(...args),
  getPushRegistrationResult: jest.fn(() => mockResult),
  requestAndRegisterPushNotifications: (...args: unknown[]) => mockRequestAndRegister(...args),
  retryPendingPushRegistration: (...args: unknown[]) => mockRetryPending(...args),
  subscribePushRegistration: jest.fn(() => jest.fn()),
  syncPushRegistration: (...args: unknown[]) => mockSyncPushRegistration(...args),
}));

jest.mock('@/utils/externalLinks', () => ({
  openSystemSettings: (...args: unknown[]) => mockOpenSystemSettings(...args),
}));

import NotificationSettingsSection from '@/components/settings/NotificationSettingsSection.native';
import NotificationSettingsSectionWeb from '@/components/settings/NotificationSettingsSection.web';

const styles = {
  card: {},
  cardRow: {},
  cardIcon: {},
  cardText: {},
  cardTitle: {},
  cardMeta: {},
  sectionTitle: {},
};
const colors = {
  border: '#000',
  primaryDark: '#000',
  primaryText: '#000',
  surface: '#fff',
};

describe('NotificationSettingsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResult = {
      status: 'notDetermined',
      permission: 'notDetermined',
      token: null,
      backendSynced: false,
    };
    mockSyncPushRegistration.mockImplementation(async () => mockResult);
    mockRequestAndRegister.mockResolvedValue({
      status: 'enabled',
      permission: 'enabled',
      token: 'ExponentPushToken[enabled]',
      backendSynced: true,
    });
    mockRetryPending.mockImplementation(async () => mockResult);
    mockOpenSystemSettings.mockResolvedValue(true);
  });

  it('opens the OS prompt only after the user presses Enable', async () => {
    const view = render(
      <NotificationSettingsSection styles={styles as never} colors={colors as never} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockRequestAndRegister).not.toHaveBeenCalled();
    expect(mockActivatePushRegistrationSession).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByLabelText(
      'profile:components.settings.NotificationSettingsSection.enableAction',
    ));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRequestAndRegister).toHaveBeenCalledTimes(1);
  });

  it('sends a denied user to system settings instead of requesting again', async () => {
    mockResult = {
      status: 'denied',
      permission: 'denied',
      token: null,
      backendSynced: false,
    };
    const view = render(
      <NotificationSettingsSection styles={styles as never} colors={colors as never} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(view.getByLabelText(
      'profile:components.settings.NotificationSettingsSection.openSettingsAction',
    ));
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockOpenSystemSettings).toHaveBeenCalledTimes(1);
    expect(mockRequestAndRegister).not.toHaveBeenCalled();
  });

  it('renders no notification UI on web', () => {
    const view = render(
      <NotificationSettingsSectionWeb styles={styles as never} colors={colors as never} />,
    );
    expect(view.toJSON()).toBeNull();
  });
});
