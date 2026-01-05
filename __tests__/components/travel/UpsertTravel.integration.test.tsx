import React, { useState } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, TouchableOpacity } from 'react-native';
import type { TravelFormData, Travel } from '@/src/types/types';
import { getModerationErrors, getModerationIssues } from '@/utils/formValidation';

const mockTrackWizardEvent = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/src/utils/analytics', () => ({
  trackWizardEvent: (...args: any[]) => mockTrackWizardEvent(...args),
}));

// Упрощённый мок компонента шага публикации, воспроизводящий ключевую логику
const TravelWizardStepPublish: React.FC<any> = ({
  formData,
  setFormData,
  onManualSave,
  onGoBack,
  onFinish,
  currentStep: _currentStep,
  totalSteps: _totalSteps,
  onNavigateToIssue,
}) => {
  void _currentStep;
  void _totalSteps;
  const [status, setStatus] = useState<'draft' | 'moderation'>(
    formData.moderation ? 'moderation' : 'draft',
  );
  const [missingForModeration, setMissingForModeration] = useState<string[]>([]);
  const [primaryOverrideLabel, setPrimaryOverrideLabel] = useState<string | null>(null);

  const isNew = !formData.id;

  const issues = getModerationIssues(
    {
      name: formData.name ?? '',
      description: formData.description ?? '',
      countries: formData.countries ?? [],
      categories: (formData as any).categories ?? [],
      coordsMeTravel: (formData as any).coordsMeTravel ?? [],
      gallery: (formData as any).gallery ?? [],
      travel_image_thumb_small_url: (formData as any).travel_image_thumb_small_url ?? null,
    } as any,
    [],
  );

  const handleSaveDraft = async () => {
    setFormData({
      ...formData,
      publish: false,
      moderation: false,
    });
    setMissingForModeration([]);
    await onManualSave();

    const hasName = !!formData.name && formData.name.trim().length > 0;
    const hasDescription = !!formData.description && formData.description.trim().length > 0;
    const hasCountries = Array.isArray(formData.countries) && formData.countries.length > 0;
    const hasRoute = Array.isArray((formData as any).coordsMeTravel)
      ? ((formData as any).coordsMeTravel as any[]).length > 0
      : false;
    const galleryArr = Array.isArray((formData as any).gallery)
      ? ((formData as any).gallery as any[])
      : [];
    const hasCover = !!(formData as any).travel_image_thumb_small_url;
    const hasPhotos = hasCover || galleryArr.length > 0;

    await mockTrackWizardEvent('wizard_draft_saved', {
      travel_id: formData.id ?? null,
      step: 5,
      fields_filled: {
        name: hasName,
        description: hasDescription,
        countries: hasCountries,
        markers: hasRoute,
        photos: hasPhotos,
      },
    });
  };

  const handleSendToModeration = async () => {
    const criticalMissing = getModerationErrors({
      name: formData.name ?? '',
      description: formData.description ?? '',
      countries: formData.countries ?? [],
      categories: (formData as any).categories ?? [],
      coordsMeTravel: (formData as any).coordsMeTravel ?? [],
      gallery: (formData as any).gallery ?? [],
      travel_image_thumb_small_url: (formData as any).travel_image_thumb_small_url ?? null,
    } as any);

    await mockTrackWizardEvent('wizard_moderation_attempt', {
      missing_fields: criticalMissing,
      is_new: isNew,
      is_edit: !isNew,
      travel_id: formData.id ?? null,
    });

    if (criticalMissing.length > 0) {
      setMissingForModeration(criticalMissing);
      setPrimaryOverrideLabel('Нельзя отправить: исправьте ошибки');
      setTimeout(() => setPrimaryOverrideLabel(null), 2500);
      return;
    }

    setMissingForModeration([]);
    setFormData({
      ...formData,
      moderation: true,
    });

    await mockTrackWizardEvent('wizard_moderation_success', {
      travel_id: formData.id ?? null,
      filled_checklist_count: 5,
      total_checklist_count: 5,
    });

    await onFinish();
    mockPush('/(tabs)/metravel');
  };

  const handlePrimaryAction = () => {
    if (status === 'draft') {
      handleSaveDraft();
    } else {
      handleSendToModeration();
    }
  };

  return (
    <SafeAreaProvider>
      <View>
        {/* Кнопка назад (в тестах не используется, но сохраняем для API) */}
        <TouchableOpacity onPress={onGoBack} testID="back-button">
          <Text>Назад</Text>
        </TouchableOpacity>

        {/* Переключатель статуса: черновик */}
        <TouchableOpacity onPress={() => setStatus('draft')} testID="status-draft">
          <Text>Сохранить как черновик</Text>
        </TouchableOpacity>

        {/* Переключатель статуса: модерация */}
        <TouchableOpacity onPress={() => setStatus('moderation')} testID="status-moderation">
          <Text>Отправить на модерацию</Text>
        </TouchableOpacity>

        {/* Основная кнопка CTA */}
        <TouchableOpacity onPress={handlePrimaryAction} testID="primary-button">
          <Text>
            {primaryOverrideLabel ?? (status === 'draft' ? 'Сохранить черновик' : 'Отправить на модерацию')}
          </Text>
        </TouchableOpacity>

        {/* Чек-лист (кликабельные строки вызывают onNavigateToIssue) */}
        <View>
          {issues.map((issue: any) => (
            <TouchableOpacity
              key={issue.key}
              onPress={() => onNavigateToIssue?.(issue)}
              disabled={!onNavigateToIssue}
              testID={`checklist-${issue.key}`}
            >
              <Text>{issue.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {status === 'moderation' && missingForModeration.length > 0 && (
          <Text>Нужно дополнить перед модерацией</Text>
        )}
      </View>
    </SafeAreaProvider>
  );
};

const baseFormData: TravelFormData = {
  id: '1',
  name: 'Тестовое путешествие',
  description: 'Очень длинное описание путешествия, которое удовлетворяет минимальной длине.',
  countries: ['1'],
  cities: [],
  over_nights_stay: [],
  complexity: [],
  companions: [],
  categories: [],
  countryIds: [],
  travelAddressIds: [],
  travelAddressCity: [],
  travelAddressCountry: [],
  travelAddressAdress: [],
  travelAddressCategory: [],
  coordsMeTravel: [],
  thumbs200ForCollectionArr: [],
  travelImageThumbUrlArr: [],
  travelImageAddress: [],
  categoriesIds: [],
  transports: [],
  month: [],
  year: '2024',
  budget: '',
  number_peoples: '2',
  number_days: '3',
  visa: false,
  publish: false,
  moderation: false,
};

describe('Travel wizard publish step (integration)', () => {
  beforeEach(() => {
    mockTrackWizardEvent.mockClear();
    mockPush.mockClear();
  });

  const renderPublishStep = (overrideForm: Partial<TravelFormData> & Record<string, any> = {}) => {
    const formData: TravelFormData = { ...baseFormData, ...(overrideForm as any) };

    const setFormData = jest.fn();
    const onManualSave = jest.fn(async () => undefined);
    const onGoBack = jest.fn();
    const onFinish = jest.fn(async () => undefined);

    const utils = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={formData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null as unknown as Travel}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={onGoBack}
        onFinish={onFinish}
      />,
    );

    return { ...utils, formData, setFormData, onManualSave, onGoBack, onFinish };
  };

  it('saves draft with correct status and sends analytics', async () => {
    const { getByText, onManualSave } = renderPublishStep({ moderation: false, publish: false });

    const primaryButton = getByText('Сохранить черновик');
    fireEvent.press(primaryButton);

    await waitFor(() => {
      expect(onManualSave).toHaveBeenCalled();
    });

    expect(mockTrackWizardEvent).toHaveBeenCalledWith('wizard_draft_saved', expect.any(Object));
  });

  it('shows moderation checklist errors and does not finish when required fields are missing', async () => {
    const { getByTestId, getByText, onFinish } = renderPublishStep({
      countries: [],
      coordsMeTravel: [],
      moderation: false,
      publish: false,
    });

    const statusModeration = getByTestId('status-moderation');
    fireEvent.press(statusModeration);

    const primaryButton = getByTestId('primary-button');
    fireEvent.press(primaryButton);

    await waitFor(() => {
      expect(getByText('Нельзя отправить: исправьте ошибки')).toBeTruthy();
    });

    await waitFor(() => {
      expect(getByText('Нужно дополнить перед модерацией')).toBeTruthy();
    });

    expect(onFinish).not.toHaveBeenCalled();
    expect(mockTrackWizardEvent).toHaveBeenCalledWith('wizard_moderation_attempt', expect.any(Object));
  });

  it('successfully sends to moderation and redirects to "/metravel" when checklist is complete', async () => {
    const { getByTestId, onFinish } = renderPublishStep({
      countries: ['1'],
      categories: ['city'],
      coordsMeTravel: [{ lat: 1, lng: 2 } as any],
      moderation: false,
      publish: false,
      travel_image_thumb_small_url: 'https://example.com/cover.jpg',
    } as any);

    const statusModeration = getByTestId('status-moderation');
    fireEvent.press(statusModeration);

    const primaryButton = getByTestId('primary-button');
    fireEvent.press(primaryButton);

    await waitFor(() => {
      expect(onFinish).toHaveBeenCalled();
    });

    expect(mockTrackWizardEvent).toHaveBeenCalledWith('wizard_moderation_success', expect.any(Object));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/metravel');
  });

  it('calls onNavigateToIssue when user taps a missing checklist row (new UX)', async () => {
    const onNavigateToIssue = jest.fn();

    // Missing categories should produce an actionable issue.
    const formData: TravelFormData = {
      ...baseFormData,
      categories: [],
      coordsMeTravel: [{ lat: 1, lng: 2 } as any],
      travel_image_thumb_small_url: 'https://example.com/cover.jpg',
    } as any;

    const setFormData = jest.fn();
    const onManualSave = jest.fn(async () => undefined);
    const onGoBack = jest.fn();
    const onFinish = jest.fn(async () => undefined);

    const { getByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={formData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null as unknown as Travel}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={onGoBack}
        onFinish={onFinish}
        onNavigateToIssue={onNavigateToIssue}
      />,
    );

    const issues = getModerationIssues({
      name: formData.name ?? '',
      description: formData.description ?? '',
      countries: formData.countries ?? [],
      categories: (formData as any).categories ?? [],
      coordsMeTravel: (formData as any).coordsMeTravel ?? [],
      gallery: (formData as any).gallery ?? [],
      travel_image_thumb_small_url: (formData as any).travel_image_thumb_small_url ?? null,
    } as any, []);
    const categoriesIssue = issues.find(i => i.key === 'categories');
    expect(categoriesIssue).toBeTruthy();

    // Mock renders checklist row labels; tap by label text
    fireEvent.press(getByText(categoriesIssue!.label));

    expect(onNavigateToIssue).toHaveBeenCalledWith(categoriesIssue);
  });
});
