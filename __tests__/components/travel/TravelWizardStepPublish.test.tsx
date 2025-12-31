import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { TravelFormData } from '@/src/types/types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));

const baseFormData: TravelFormData = {
  id: '640',
  slug: 'test',
  name: 'Test travel',
  countries: ['1'],
  cities: [],
  over_nights_stay: [],
  complexity: [],
  companions: [],
  description: 'This is a sufficiently long and detailed description to satisfy moderation requirements and exceed fifty characters.',
  plus: null,
  minus: null,
  recommendation: null,
  youtube_link: null,
  gallery: [],
  categories: ['1'],
  countryIds: [],
  travelAddressIds: [],
  travelAddressCity: [],
  travelAddressCountry: [],
  travelAddressAdress: [],
  travelAddressCategory: [],
  coordsMeTravel: [{ lat: 0, lng: 0, categories: [] }],
  thumbs200ForCollectionArr: [],
  travelImageThumbUrlArr: [],
  travelImageAddress: [],
  travel_image_thumb_small_url: 'https://example.com/cover.jpg',
  categoriesIds: [],
  transports: [],
  month: [],
  visa: false,
  publish: false,
  moderation: false,
};

describe('TravelWizardStepPublish - moderation submit', () => {
  it('sets publish=true and moderation=false when sending to moderation (user flow)', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const { getByText, getAllByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    const statusToggle = getByText('Отправить на модерацию');
    await act(async () => {
      fireEvent.press(statusToggle);
    });

    const primaryButtons = getAllByText('Отправить на модерацию');
    const primarySubmit = primaryButtons[primaryButtons.length - 1];

    await act(async () => {
      fireEvent.press(primarySubmit);
    });

    // setFormData called with publish true, moderation false
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: true,
        moderation: false,
      })
    );

    // onManualSave invoked with the same payload (triggers email on backend)
    expect(onManualSave).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: true,
        moderation: false,
      })
    );
  });

  it('admin approve sets moderation=true and publish=true', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const adminData: TravelFormData = {
      ...baseFormData,
      publish: true, // маршрут уже отправлен на модерацию
      moderation: false,
    };

    const { getByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={adminData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null}
        isSuperAdmin={true}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    const approveButton = getByText('Одобрить модерацию');

    await act(async () => {
      fireEvent.press(approveButton);
    });

    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: true,
        moderation: true,
      })
    );

    expect(onManualSave).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: true,
        moderation: true,
      })
    );

    expect(onFinish).not.toHaveBeenCalled();
  });

  it('shows admin panel when publish=true and moderation=false', () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const adminData: TravelFormData = {
      ...baseFormData,
      publish: true,
      moderation: false,
    };

    const { getByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={adminData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null}
        isSuperAdmin={true}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    expect(getByText('Панель модератора')).toBeTruthy();
    expect(getByText('Одобрить модерацию')).toBeTruthy();
    expect(getByText('Отклонить')).toBeTruthy();
  });

  it('hides status switch when already sent to moderation', () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const adminData: TravelFormData = {
      ...baseFormData,
      publish: true,
      moderation: false,
    };

    const { queryByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={adminData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null}
        isSuperAdmin={true}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    expect(queryByText('Статус публикации')).toBeNull();
  });

  it('saves draft with publish=false and moderation=false when user switches from published', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const publishedData: TravelFormData = {
      ...baseFormData,
      publish: true,
      moderation: true,
    };

    const { getByText, getAllByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={publishedData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    await act(async () => {
      const draftLabel = getByText('Сохранить как черновик');
      const draftRow = draftLabel.parent?.parent;
      if (!draftRow) {
        throw new Error('Draft option row not found');
      }
      fireEvent.press(draftRow);
    });

    const primaryButtons = getAllByText('Сохранить');
    const primarySubmit = primaryButtons[primaryButtons.length - 1];

    await act(async () => {
      fireEvent.press(primarySubmit);
    });

    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: false,
        moderation: false,
      })
    );

    expect(onManualSave).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: false,
        moderation: false,
      })
    );
  });

  it('reject click is guarded to one call when already pending', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const adminData: TravelFormData = {
      ...baseFormData,
      publish: true,
      moderation: false,
    };

    const { getByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={adminData}
        setFormData={setFormData}
        filters={{}}
        travelDataOld={null}
        isSuperAdmin={true}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    const rejectButton = getByText('Отклонить');

    await act(async () => {
      fireEvent.press(rejectButton);
      fireEvent.press(rejectButton);
    });

    expect(onManualSave).toHaveBeenCalledTimes(1);
    expect(onManualSave).toHaveBeenCalledWith(
      expect.objectContaining({
        publish: false,
        moderation: false,
      })
    );

    expect(onFinish).not.toHaveBeenCalled();
  });
});
