import React from 'react';
import { render } from '@testing-library/react-native';

import UpsertTravel from '@/components/travel/UpsertTravel';

let mockAuthState = {
  isAuthenticated: true,
  isSuperuser: false,
  userId: '42',
  authReady: true,
};

let mockLocalParams: Record<string, string> = {};
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
  useLocalSearchParams: () => mockLocalParams,
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
  }),
}));

jest.mock('@/components/travel/TravelWizardStepBasic', () => {
  const { View, Text } = require('react-native');
  return function MockStepBasic() {
    return (
      <View>
        <Text>Step1</Text>
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
    mockLocalParams = {};
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
      userId: null,
      authReady: true,
    };

    const { getByText } = render(<UpsertTravel />);

    expect(getByText('Войдите, чтобы создать путешествие')).toBeTruthy();
    expect(capturedFormArgs?.isNew).toBe(true);
  });

  it('shows access error when editing without access', () => {
    mockLocalParams = { id: '123' };
    mockFormState = {
      ...mockFormState,
      hasAccess: false,
    };

    const { getByText } = render(<UpsertTravel />);

    expect(getByText('Нет доступа к редактированию')).toBeTruthy();
    expect(capturedFormArgs?.isNew).toBe(false);
    expect(capturedFormArgs?.travelId).toBe('123');
  });

  it('renders step 1 for editing when access is granted', () => {
    mockLocalParams = { id: '321' };

    const { getByText } = render(<UpsertTravel />);

    expect(getByText('Step1')).toBeTruthy();
    expect(capturedFormArgs?.isNew).toBe(false);
    expect(capturedFormArgs?.travelId).toBe('321');
  });
});
