import { render, fireEvent, waitFor } from '@testing-library/react-native';

import UpsertTravel from '@/components/travel/UpsertTravel';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockAddListener = jest.fn(() => () => {});

let capturedExtrasFilters: any = null;

let mockAuthState = {
  isAuthenticated: true,
  isSuperuser: false,
  userId: '42',
  authReady: true,
};

const mockFetchFilters = jest.fn();
const mockFetchAllCountries = jest.fn().mockResolvedValue([]);

jest.mock('@/utils/formValidation', () => ({
  validateStep: jest.fn(() => ({ isValid: true, errors: [] })),
}));

jest.mock('@/src/utils/analytics', () => ({
  trackWizardEvent: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({
    addListener: mockAddListener,
    dispatch: jest.fn(),
  }),
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/src/api/misc', () => ({
  fetchFilters: () => mockFetchFilters(),
  fetchAllCountries: () => mockFetchAllCountries(),
  saveFormData: jest.fn(async (d: any) => d),
}));

jest.mock('@/src/api/travelsApi', () => ({
  fetchTravel: jest.fn(),
}));

jest.mock('@/hooks/useImprovedAutoSave', () => ({
  useImprovedAutoSave: (data: any) => {
    return {
      status: 'idle',
      lastSaved: null,
      error: null,
      canSave: true,
      hasUnsavedChanges: false,
      saveNow: jest.fn(async () => data),
      updateBaseline: jest.fn(),
      clearError: jest.fn(),
    };
  },
}));

jest.mock('@/components/travel/TravelWizardStepBasic', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockStepBasic(props: any) {
    return (
      <View>
        <Text>Step1</Text>
        <TouchableOpacity testID="next-1" onPress={props.onGoNext}>
          <Text>Next</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('@/components/travel/TravelWizardStepRoute', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockStepRoute(props: any) {
    return (
      <View>
        <Text>Step2</Text>
        <TouchableOpacity testID="next-2" onPress={props.onNext}>
          <Text>Next</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('@/components/travel/TravelWizardStepMedia', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockStepMedia(props: any) {
    return (
      <View>
        <Text>Step3</Text>
        <TouchableOpacity testID="next-3" onPress={props.onNext}>
          <Text>Next</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('@/components/travel/TravelWizardStepDetails', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockStepDetails(props: any) {
    return (
      <View>
        <Text>Step4</Text>
        <TouchableOpacity testID="next-4" onPress={props.onNext}>
          <Text>Next</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('@/components/travel/TravelWizardStepExtras', () => {
  const { View, Text } = require('react-native');
  return function MockStepExtras(props: any) {
    capturedExtrasFilters = props.filters;
    return (
      <View testID="step-5">
        <Text>Step5</Text>
      </View>
    );
  };
});

jest.mock('@/components/travel/TravelWizardStepPublish', () => {
  const { View, Text } = require('react-native');
  return function MockStepPublish() {
    return (
      <View>
        <Text>Step6</Text>
      </View>
    );
  };
});

describe('UpsertTravel categories filters integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedExtrasFilters = null;
    mockAuthState = {
      isAuthenticated: true,
      isSuperuser: false,
      userId: '42',
      authReady: true,
    };
  });

  const advanceToStep5 = async (utils: ReturnType<typeof render>) => {
    await waitFor(() => {
      expect(utils.getByTestId('next-1')).toBeTruthy();
    });

    fireEvent.press(utils.getByTestId('next-1'));

    await waitFor(() => {
      expect(utils.getByTestId('next-2')).toBeTruthy();
    });
    fireEvent.press(utils.getByTestId('next-2'));

    await waitFor(() => {
      expect(utils.getByTestId('next-3')).toBeTruthy();
    });
    fireEvent.press(utils.getByTestId('next-3'));

    await waitFor(() => {
      expect(utils.getByTestId('next-4')).toBeTruthy();
    });
    fireEvent.press(utils.getByTestId('next-4'));

    await waitFor(() => {
      expect(utils.getByTestId('step-5')).toBeTruthy();
    });
  };

  it('normalizes categories returned as strings into {id,name} items', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: ['Горы', 'Море'],
      categoryTravelAddress: [],
      transports: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      countries: [],
    });

    const utils = render(<UpsertTravel />);
    await advanceToStep5(utils);

    await waitFor(() => {
      expect(Array.isArray(capturedExtrasFilters?.categories)).toBe(true);
      expect(
        capturedExtrasFilters.categories.every(
          (c: any) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string'
        )
      ).toBe(true);

      const names = capturedExtrasFilters.categories.map((c: any) => c.name);
      expect(names).toContain('Горы');
      expect(names).toContain('Море');
    });
  });

  it('shows empty categories when API returns empty categories', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: [],
      categoryTravelAddress: [],
      transports: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      countries: [],
    });

    const utils = render(<UpsertTravel />);
    await advanceToStep5(utils);

    expect(Array.isArray(capturedExtrasFilters?.categories)).toBe(true);
    expect(capturedExtrasFilters.categories.length).toBe(0);
  });

  it('uses API categories (even when nested) instead of fallback defaults', async () => {
    mockFetchFilters.mockResolvedValue({
      categories: ['Дайвинг', 'Сафари'],
      categoryTravelAddress: [],
      transports: [],
      companions: [],
      complexity: [],
      month: [],
      over_nights_stay: [],
      countries: [],
    });

    const utils = render(<UpsertTravel />);

    await waitFor(() => {
      expect(mockFetchFilters).toHaveBeenCalled();
    });

    await advanceToStep5(utils);

    await waitFor(() => {
      const names = (capturedExtrasFilters?.categories ?? []).map((c: any) => c?.name);
      expect(names).toContain('Дайвинг');
      expect(names).toContain('Сафари');
      expect(names).not.toContain('Горы');
    }, { timeout: 3000 });
  });
});
