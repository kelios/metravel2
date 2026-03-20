import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { TravelFormData } from '@/types/types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/api/instagramPublish', () => ({
  publishTravelToInstagram: jest.fn().mockResolvedValue({ status: 'queued' }),
}));

import { showToast } from '@/utils/toast';
import { publishTravelToInstagram } from '@/api/instagramPublish';

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
  gallery: [{ id: 1, url: 'https://example.com/gallery-1.jpg' }],
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders publish step basics (smoke)', () => {
    const { getByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={false}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    expect(getByText('Готовность к публикации')).toBeTruthy();
  });

  it('sets publish=true and moderation=false when sending to moderation (user flow)', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const { getByText, getByTestId } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={setFormData}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    // Tap the actual option row (TouchableOpacity), not the nested Text node
    const moderationLabel = getByText('Отправить на модерацию');
    const moderationRow = moderationLabel.parent?.parent;
    if (!moderationRow) {
      throw new Error('Moderation option row not found');
    }
    await act(async () => {
      fireEvent.press(moderationRow);
    });

    // Press the header primary button (it uses accessibilityLabel=primaryLabel)
    const primarySubmit = getByTestId('primary-button');
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
        isSuperAdmin={true}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    expect(getByText('Панель модератора')).toBeTruthy();
    expect(getByText('Одобрить модерацию')).toBeTruthy();
    expect(getByText('Отклонить')).toBeTruthy();
    expect(getByText('Instagram публикация')).toBeTruthy();
    expect(getByText('Скопировать текст')).toBeTruthy();
    expect(getByText('Опубликовать в Instagram')).toBeTruthy();
  });

  it('hides the instagram publication block for regular users', () => {
    const { queryByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={false}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    expect(queryByText('Instagram публикация')).toBeNull();
    expect(queryByText('Скопировать текст')).toBeNull();
    expect(queryByText('Опубликовать в Instagram')).toBeNull();
  });

  it('publishes to instagram for superadmin with generated payload', async () => {
    const previousAccounts = process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS;
    process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = JSON.stringify([
      { key: 'metravelby', label: '@metravelby' },
    ]);

    try {
      const { getByText } = render(
        <TravelWizardStepPublish
          currentStep={6}
          totalSteps={6}
          formData={{
            ...baseFormData,
            name: 'Минск и Несвиж',
            countries: ['1'],
            coordsMeTravel: [
              { lat: 53.9, lng: 27.56, address: 'Минск', categories: [] },
              { lat: 53.22, lng: 26.68, address: 'Несвиж', categories: [] },
            ],
          }}
          countries={[{ country_id: '1', title_ru: 'Беларусь' }]}
          setFormData={jest.fn()}
          isSuperAdmin={true}
          onManualSave={jest.fn()}
          onGoBack={jest.fn()}
          onFinish={jest.fn()}
        />
      );

      await act(async () => {
        fireEvent.press(getByText('Опубликовать в Instagram'));
      });

      expect(publishTravelToInstagram).toHaveBeenCalledWith(
        expect.objectContaining({
          travelId: 640,
          accountKey: 'metravelby',
          hashtags: expect.arrayContaining(['#metravelby', '#беларусь', '#минск', '#несвиж']),
          imageUrls: ['https://example.com/gallery-1.jpg'],
        })
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Публикация запущена',
        })
      );
    } finally {
      process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = previousAccounts;
    }
  });

  it('allows editing instagram caption and hashtags before publishing', async () => {
    const previousAccounts = process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS;
    process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = JSON.stringify([
      { key: 'metravelby', label: '@metravelby' },
    ]);

    try {
      const { getByLabelText, getByText } = render(
        <TravelWizardStepPublish
          currentStep={6}
          totalSteps={6}
          formData={{
            ...baseFormData,
            name: 'Jaskinia na Łopiankach',
            countries: ['1'],
          }}
          countries={[{ country_id: '1', title_ru: 'Польша' }]}
          setFormData={jest.fn()}
          isSuperAdmin={true}
          onManualSave={jest.fn()}
          onGoBack={jest.fn()}
          onFinish={jest.fn()}
        />
      );

      await act(async () => {
        fireEvent.changeText(getByLabelText('Текст поста для Instagram'), 'Новый caption');
        fireEvent.changeText(getByLabelText('Хэштеги для Instagram'), '#metravelby #польша #краков');
      });

      await act(async () => {
        fireEvent.press(getByText('Опубликовать в Instagram'));
      });

      expect(publishTravelToInstagram).toHaveBeenCalledWith(
        expect.objectContaining({
          caption: 'Новый caption',
          hashtags: ['#metravelby', '#польша', '#краков'],
        })
      );
    } finally {
      process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = previousAccounts;
    }
  });

  it('publishes instagram images in manually reordered sequence', async () => {
    const previousAccounts = process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS;
    process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = JSON.stringify([
      { key: 'metravelby', label: '@metravelby' },
    ]);

    try {
      const { getByTestId, getByText } = render(
        <TravelWizardStepPublish
          currentStep={6}
          totalSteps={6}
          formData={{
            ...baseFormData,
            gallery: [
              { id: 1, url: 'https://example.com/gallery-1.jpg' },
              { id: 2, url: 'https://example.com/gallery-2.jpg' },
              { id: 3, url: 'https://example.com/gallery-3.jpg' },
            ],
          }}
          countries={[{ country_id: '1', title_ru: 'Польша' }]}
          setFormData={jest.fn()}
          isSuperAdmin={true}
          onManualSave={jest.fn()}
          onGoBack={jest.fn()}
          onFinish={jest.fn()}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId('instagram-move-right-0'));
      });

      await act(async () => {
        fireEvent.press(getByText('Опубликовать в Instagram'));
      });

      expect(publishTravelToInstagram).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrls: [
            'https://example.com/gallery-2.jpg',
            'https://example.com/gallery-1.jpg',
            'https://example.com/gallery-3.jpg',
          ],
        })
      );
    } finally {
      process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = previousAccounts;
    }
  });

  it('excludes selected instagram image from publication payload', async () => {
    const previousAccounts = process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS;
    process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = JSON.stringify([
      { key: 'metravelby', label: '@metravelby' },
    ]);

    try {
      const { getByTestId, getAllByTestId, getByText } = render(
        <TravelWizardStepPublish
          currentStep={6}
          totalSteps={6}
          formData={{
            ...baseFormData,
            gallery: [
              { id: 1, url: 'https://example.com/gallery-1.jpg' },
              { id: 2, url: 'https://example.com/gallery-2.jpg' },
              { id: 3, url: 'https://example.com/gallery-3.jpg' },
            ],
          }}
          countries={[{ country_id: '1', title_ru: 'Польша' }]}
          setFormData={jest.fn()}
          isSuperAdmin={true}
          onManualSave={jest.fn()}
          onGoBack={jest.fn()}
          onFinish={jest.fn()}
        />
      );

      expect(getAllByTestId('instagram-preview-image')).toHaveLength(3);

      await act(async () => {
        fireEvent.press(getByTestId('instagram-remove-1'));
      });

      expect(getAllByTestId('instagram-preview-image')).toHaveLength(2);

      await act(async () => {
        fireEvent.press(getByText('Опубликовать в Instagram'));
      });

      expect(publishTravelToInstagram).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrls: [
            'https://example.com/gallery-1.jpg',
            'https://example.com/gallery-3.jpg',
          ],
        })
      );
    } finally {
      process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = previousAccounts;
    }
  });

  it('auto-clamps instagram caption to publish-ready length', async () => {
    const previousAccounts = process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS;
    process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = JSON.stringify([
      { key: 'metravelby', label: '@metravelby' },
    ]);
    (publishTravelToInstagram as jest.Mock).mockClear();
    (showToast as jest.Mock).mockClear();

    try {
      const { getByLabelText, getByText } = render(
        <TravelWizardStepPublish
          currentStep={6}
          totalSteps={6}
          formData={{
            ...baseFormData,
            gallery: [
              { id: 1, url: 'https://example.com/gallery-1.jpg' },
            ],
          }}
          countries={[{ country_id: '1', title_ru: 'Польша' }]}
          setFormData={jest.fn()}
          isSuperAdmin={true}
          onManualSave={jest.fn()}
          onGoBack={jest.fn()}
          onFinish={jest.fn()}
        />
      );

      const tooLongCaption = 'а'.repeat(2201);

      await act(async () => {
        fireEvent.changeText(getByLabelText('Текст поста для Instagram'), tooLongCaption);
      });

      expect(getByText('2200/2200 символов')).toBeTruthy();

      expect(publishTravelToInstagram).not.toHaveBeenCalled();
      expect(getByLabelText('Опубликовать в Instagram').props.accessibilityState.disabled).toBe(false);
      expect(showToast).not.toHaveBeenCalled();
    } finally {
      process.env.EXPO_PUBLIC_INSTAGRAM_PUBLISH_ACCOUNTS = previousAccounts;
    }
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

    const { getByText, getByLabelText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={publishedData}
        setFormData={setFormData}
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

    // Press the header primary button (it uses accessibilityLabel=primaryLabel)
    const primarySubmit = getByLabelText('Сохранить');
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

  it('keeps draft save flow working even when backend returns empty response payload', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const setFormData = jest.fn();
    const onFinish = jest.fn();
    const newTravelData: TravelFormData = {
      ...baseFormData,
      id: null,
    };

    const { getByTestId, queryByTestId } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={newTravelData}
        setFormData={setFormData}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={onFinish}
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId('primary-button'));
    });

    expect(onManualSave).toHaveBeenCalled();
    expect(queryByTestId('publish-save-error-banner')).toBeNull();
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

  it('restores previous status and shows error when moderation save fails', async () => {
    const onManualSave = jest.fn().mockRejectedValue(new Error('Network error'));
    const setFormData = jest.fn();

    const { getByText, getByTestId } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={setFormData}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const moderationLabel = getByText('Отправить на модерацию');
    const moderationRow = moderationLabel.parent?.parent;
    if (!moderationRow) {
      throw new Error('Moderation option row not found');
    }

    await act(async () => {
      fireEvent.press(moderationRow);
    });

    await act(async () => {
      fireEvent.press(getByTestId('primary-button'));
    });

    expect(setFormData).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        publish: true,
        moderation: false,
      })
    );
    expect(setFormData).toHaveBeenLastCalledWith(baseFormData);
    expect(showToast).toHaveBeenCalledWith({
      type: 'error',
      text1: 'Не удалось отправить',
      text2: 'Network error',
    });
  });
});
