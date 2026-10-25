import { act, fireEvent, render } from '@testing-library/react-native';
import { i18n } from '@/i18n';

import UpsertTravel from '@/components/travel/UpsertTravel';

const mockSeo = jest.fn(() => null);
const mockPush = jest.fn();
const mockRouteCreateStarted = jest.fn();
let mockFiltersError: Error | null = null;
const mockRetryFilters = jest.fn(async () => {});

let mockAuthState = {
  isAuthenticated: true,
  isSuperuser: false,
  userId: '42',
  authReady: true,
};

let mockLocalParams: Record<string, string> = {};
let mockPathname = '/travel/new';
let capturedFormArgs: any = null;

let mockFormState: any = {
  formData: { id: null, countries: [] },
  setFormData: jest.fn(),
  markers: [],
  setMarkers: jest.fn(),
  travelDataOld: null,
  isInitialLoading: false,
  hasAccess: true,
  autosave: {
    status: 'idle',
    error: null,
    hasUnsavedChanges: false,
    canSave: true,
    clearError: jest.fn(),
  },
  handleManualSave: jest.fn(),
  handleCountrySelect: jest.fn(),
  handleCountryDeselect: jest.fn(),
};

let mockWizardState: any = {
  currentStep: 1,
  totalSteps: 6,
  stepConfig: [],
  step1SubmitErrors: [],
  focusAnchorId: null,
  handleNext: jest.fn(),
  handleBack: jest.fn(),
  handleStepSelect: jest.fn(),
  handleAnchorHandled: jest.fn(),
  handleFinishWizard: jest.fn(),
  handleNavigateToIssue: jest.fn(),
};

jest.mock('expo-router', () => ({
  usePreventRemove: () => jest.fn(),
  useLocalSearchParams: () => mockLocalParams,
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
  }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/hooks/useTravelFormData', () => ({
  useTravelFormData: (args: any) => {
    capturedFormArgs = args;
    return mockFormState;
  },
}));

jest.mock('@/hooks/useTravelWizard', () => ({
  useTravelWizard: () => mockWizardState,
}));

jest.mock('@/hooks/useTravelFilters', () => ({
  useTravelFilters: () => ({
    filters: { categoryTravelAddress: [], countries: [] },
    isLoading: false,
    error: mockFiltersError,
    loadFilters: mockRetryFilters,
  }),
}));

jest.mock('@/utils/growthFunnelAnalytics', () => ({
  ...jest.requireActual('@/utils/growthFunnelAnalytics'),
  trackRouteCreateStarted: (...args: unknown[]) => mockRouteCreateStarted(...args),
}));

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: (props: any) => mockSeo(props),
}));

jest.mock('@/components/travel/TravelWizardStepBasic', () => {
  const { Pressable, Text, View } = require('react-native');
  return function MockStepBasic() {
    return (
      <View>
        <Text>Step1</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Step 1 action">
          <Text>Step 1 action</Text>
        </Pressable>
      </View>
    );
  };
});

jest.mock('@/components/travel/TravelWizardStepRoute', () => {
  const { View } = require('react-native');
  return function MockStepRoute() {
    return <View />;
  };
});

jest.mock('@/components/travel/TravelWizardStepMedia', () => {
  const { View } = require('react-native');
  return function MockStepMedia() {
    return <View />;
  };
});

jest.mock('@/components/travel/TravelWizardStepDetails', () => {
  const { View } = require('react-native');
  return function MockStepDetails() {
    return <View />;
  };
});

jest.mock('@/components/travel/TravelWizardStepExtras', () => {
  const { View } = require('react-native');
  return function MockStepExtras() {
    return <View />;
  };
});

jest.mock('@/components/travel/TravelWizardStepPublish', () => {
  const { View } = require('react-native');
  return function MockStepPublish() {
    return <View />;
  };
});

describe('UpsertTravel create/edit flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFiltersError = null;
    mockLocalParams = {};
    mockPathname = '/travel/new';
    capturedFormArgs = null;
    mockAuthState = {
      isAuthenticated: true,
      isSuperuser: false,
      userId: '42',
      authReady: true,
    };
    mockFormState = {
      ...mockFormState,
      isInitialLoading: false,
      hasAccess: true,
    };
    mockWizardState = {
      ...mockWizardState,
      currentStep: 1,
    };
  });

  it('shows auth error when creating and user is not authenticated', () => {
    mockAuthState = {
      isAuthenticated: false,
      isSuperuser: false,
      userId: '',
      authReady: true,
    };

    const { getByText } = render(<UpsertTravel />);

    expect(getByText('Войдите в аккаунт')).toBeTruthy();
    expect(capturedFormArgs?.isNew).toBe(true);
  });

  it('preserves the bounded article context when registration returns without a session and the reader chooses login', () => {
    mockLocalParams = { source_travel_id: '42', country: 'PL', place: 'Краков', token: 'ignored', mode: 'note' };
    mockAuthState = { ...mockAuthState, isAuthenticated: false, userId: '' };
    const view = render(<UpsertTravel />);
    fireEvent.press(view.getByRole('button', { name: 'Войти и вернуться к созданию путешествия' }));
    const login = new URL(mockPush.mock.calls[0][0], 'https://metravel.by');
    expect(login.pathname).toBe('/login');
    expect(login.searchParams.get('intent')).toBe('share-trip');
    expect(login.searchParams.get('redirect')).toBe('/travel/new?source_travel_id=42&country=PL&place=%D0%9A%D1%80%D0%B0%D0%BA%D0%BE%D0%B2');
    expect(login.searchParams.get('redirect')).not.toMatch(/token|mode/);
    fireEvent.press(view.getByRole('button', { name: 'Зарегистрироваться и вернуться к созданию путешествия' }));
    const registration = new URL(mockPush.mock.calls[1][0], 'https://metravel.by');
    expect(registration.searchParams.get('redirect')).toBe(login.searchParams.get('redirect'));
    expect(registration.searchParams.get('intent')).toBe('share-trip');
    expect(mockRouteCreateStarted).not.toHaveBeenCalled();

    mockAuthState = { ...mockAuthState, isAuthenticated: true, userId: '42' };
    view.rerender(<UpsertTravel />);
    expect(mockRouteCreateStarted).toHaveBeenCalledTimes(1);
    expect(mockRouteCreateStarted).toHaveBeenCalledWith(expect.objectContaining({
      source: 'travel_article_cta', sourceTravelId: '42', step: 1,
    }));
    view.rerender(<UpsertTravel />);
    expect(mockRouteCreateStarted).toHaveBeenCalledTimes(1);
  });

  it('shows access error when editing without access', () => {
    mockLocalParams = { id: '123' };
    mockPathname = '/travel/123';
    mockFormState = {
      ...mockFormState,
      hasAccess: false,
    };

    const { getByText } = render(<UpsertTravel />);

    expect(getByText('Нет доступа')).toBeTruthy();
    expect(capturedFormArgs?.isNew).toBe(false);
    expect(capturedFormArgs?.travelId).toBe('123');
  });

  it('renders step 1 for editing when access is granted', () => {
    mockLocalParams = { id: '321' };
    mockPathname = '/travel/321';

    const { getByText } = render(<UpsertTravel />);

    expect(getByText('Step1')).toBeTruthy();
    expect(capturedFormArgs?.isNew).toBe(false);
    expect(capturedFormArgs?.travelId).toBe('321');
  });

  it('keeps the editor root structural while interactive descendants stay addressable', () => {
    const { getByRole, getByTestId } = render(<UpsertTravel />);

    const root = getByTestId('travel-upsert.root');

    expect(root.props.accessibilityLabel).toBeUndefined();
    expect(root.props.accessible).not.toBe(true);
    expect(getByRole('button', { name: 'Step 1 action' })).toBeTruthy();
  });

  it('sets explicit SEO title for the edit page', () => {
    mockLocalParams = { id: '321' };
    mockPathname = '/travel/321';
    mockFormState = {
      ...mockFormState,
      formData: { id: 321, name: 'Energylandia', countries: [] },
    };

    render(<UpsertTravel />);

    expect(mockSeo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Редактировать путешествие: Energylandia | Metravel',
        canonical: 'https://metravel.by/travel/321',
        robots: 'noindex, nofollow',
      })
    );
  });

  it('sets explicit SEO title for the create page', () => {
    render(<UpsertTravel />);

    expect(mockSeo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Создать путешествие | Metravel',
        canonical: 'https://metravel.by/travel/new',
        robots: 'noindex, nofollow',
      })
    );
  });

  it('shows a localized dictionary failure with retry without discarding the editor', async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    try {
      mockFiltersError = new Error('HTTP 502: upstream failure');
      const view = render(<UpsertTravel />);
      expect(view.getByText('Failed to load filters')).toBeTruthy();
      expect(view.queryByText('HTTP 502: upstream failure')).toBeNull();
      expect(view.getByTestId('travel-upsert.root')).toBeTruthy();
      expect(view.getByText('Step1')).toBeTruthy();
      fireEvent.press(view.getByRole('button', { name: 'Retry' }));
      expect(mockRetryFilters).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => { await i18n.changeLanguage('ru'); });
    }
  });
});
