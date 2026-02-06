import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';

import UpsertTravel from '@/components/travel/UpsertTravel';
import MultiSelectField from '@/components/forms/MultiSelectField';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockAddListener = jest.fn(() => () => {});

let mockAuthState = {
  isAuthenticated: true,
  isSuperuser: false,
  userId: '42',
  authReady: true,
};

const mockFetchFilters = jest.fn();
const mockFetchAllCountries = jest.fn();

jest.mock('@/components/MultiSelectField', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock('react-native-paper', () => {
  return {
    Button: () => null,
  };
});

jest.mock('@/utils/formValidation', () => ({
  validateStep: jest.fn(() => ({ isValid: true, errors: [], warnings: [] })),
}));

jest.mock('@/src/utils/analytics', () => ({
  trackWizardEvent: jest.fn(),
}));

jest.mock('@/components/travel/TravelWizardHeader', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

jest.mock('@/components/travel/TravelWizardFooter', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

jest.mock('@/components/travel/ValidationFeedback', () => {
  return {
    __esModule: true,
    ValidationSummary: () => null,
  };
});

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

// Make steps cheap and allow rapid navigation
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

describe('UpsertTravel step 5 filters race regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      isAuthenticated: true,
      isSuperuser: false,
      userId: '42',
      authReady: true,
    };
  });

  const advanceToStep5Fast = async (utils: ReturnType<typeof render>) => {
    await waitFor(() => expect(utils.getByTestId('next-1')).toBeTruthy());
    fireEvent.press(utils.getByTestId('next-1'));

    await waitFor(() => expect(utils.getByTestId('next-2')).toBeTruthy());
    fireEvent.press(utils.getByTestId('next-2'));

    await waitFor(() => expect(utils.getByTestId('next-3')).toBeTruthy());
    fireEvent.press(utils.getByTestId('next-3'));

    await waitFor(() => expect(utils.getByTestId('next-4')).toBeTruthy());
    fireEvent.press(utils.getByTestId('next-4'));
  };

  it('does not render empty MultiSelect lists when filters resolve after fast navigation to step 5', async () => {
    let resolveFilters: (v: any) => void = () => {};
    const filtersPromise = new Promise((res) => {
      resolveFilters = res as any;
    });

    mockFetchAllCountries.mockResolvedValue([{ country_id: 3, title_ru: 'Беларусь' }]);
    mockFetchFilters.mockImplementation(() => filtersPromise);

    const utils = render(<UpsertTravel />);

    // Fast navigate to step 5 before filters resolve
    await advanceToStep5Fast(utils);

    await waitFor(() => {
      expect(mockFetchFilters).toHaveBeenCalled();
    });

    const ms = MultiSelectField as unknown as jest.Mock;

    // Fallback invariant: categories must not be empty even before API filters resolve
    await waitFor(
      () => {
        const calls = ms.mock.calls.map((c) => c[0]);

        const assertNonEmpty = (label: string) => {
          const same = calls.filter((p: any) => p?.label === label);
          expect(same.length).toBeGreaterThan(0);
          const last = same[same.length - 1];
          expect(Array.isArray(last.items)).toBe(true);
          expect(last.items.length).toBeGreaterThan(0);
        };

        assertNonEmpty('Категории путешествий *');
        assertNonEmpty('Средства передвижения');
        assertNonEmpty('Физическая подготовка');
        assertNonEmpty('Путешествуете с...');
        assertNonEmpty('Ночлег...');
        assertNonEmpty('Месяц путешествия');
      },
      { timeout: 3000 }
    );

    // Now filters resolve (simulating network response after the user already reached step 5)
    await act(async () => {
      resolveFilters({
        categories: [{ id: 1, name: 'Дайвинг' }],
        transports: [{ id: 1, name: 'Машина' }],
        complexity: [{ id: 1, name: 'Зеленый' }],
        companions: [{ id: 3, name: 'Собака' }],
        over_nights_stay: [{ id: 1, name: 'Палатка' }],
        month: [{ id: 1, name: 'Январь' }],
        categoryTravelAddress: [{ id: 1, name: 'Парковка' }],
      });

      // flush microtasks and let the UpsertTravel async effect commit state
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    });

    // After filters resolve, lists must still be non-empty (race must not wipe data)
    await waitFor(
      () => {
        const calls = ms.mock.calls.map((c) => c[0]);
        const assertNonEmpty = (label: string) => {
          const same = calls.filter((p: any) => p?.label === label);
          expect(same.length).toBeGreaterThan(0);
          const last = same[same.length - 1];
          expect(Array.isArray(last.items)).toBe(true);
          expect(last.items.length).toBeGreaterThan(0);
        };

        assertNonEmpty('Категории путешествий *');
        assertNonEmpty('Средства передвижения');
        assertNonEmpty('Физическая подготовка');
        assertNonEmpty('Путешествуете с...');
        assertNonEmpty('Ночлег...');
        assertNonEmpty('Месяц путешествия');
      },
      { timeout: 3000 }
    );
  });
});
