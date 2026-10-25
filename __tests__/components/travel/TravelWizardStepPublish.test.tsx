import { render, renderHook, fireEvent, act, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { Platform } from 'react-native';

import TravelWizardStepPublish from '@/components/travel/TravelWizardStepPublish';
import { useTravelPublishModeration } from '@/components/travel/useTravelPublishModeration';
import { TravelFormData } from '@/types/types';

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  usePreventRemove: () => jest.fn(),
  useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn() }),
  useFocusEffect: require('react').useEffect,
}));

jest.mock('@/api/messages', () => ({ sendMessage: jest.fn().mockResolvedValue({}) }));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
jest.mock('@/utils/toast', () => {
  const showToast = jest.fn();
  return {
    showToast,
    showToastMessage: showToast,
  };
});
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/utils/shareTravel', () => ({
  shareTravel: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/api/instagramPublish', () => ({
  publishTravelToInstagram: jest
    .fn()
    .mockResolvedValue({ status: 'ok', postUrl: 'https://www.instagram.com/p/TEST/' }),
  fetchInstagramOAuthStartUrl: jest
    .fn()
    .mockResolvedValue('https://www.facebook.com/v19.0/dialog/oauth?client_id=test-app'),
}));
jest.mock('@/api/facebookPublish', () => ({
  FACEBOOK_PUBLISH_PHOTO_MAX_COUNT: 10,
  fetchFacebookPublishStatus: jest.fn().mockResolvedValue({
    configured: true,
    connected: true,
    pageId: 'server-page-id',
    pageName: 'MeTravel',
    canPublish: true,
  }),
  fetchFacebookOAuthStartUrl: jest
    .fn()
    .mockResolvedValue('https://www.facebook.com/v25.0/dialog/oauth?client_id=test-app'),
  publishTravelToFacebook: jest
    .fn()
    .mockResolvedValue({ status: 'published', postUrl: 'https://www.facebook.com/test-post' }),
}));

import { showToast } from '@/utils/toast';
import { sendMessage } from '@/api/messages';
import { openExternalUrl } from '@/utils/externalLinks';
import { publishTravelToInstagram, fetchInstagramOAuthStartUrl } from '@/api/instagramPublish';
import {
  fetchFacebookOAuthStartUrl,
  fetchFacebookPublishStatus,
  publishTravelToFacebook,
} from '@/api/facebookPublish';
import { ApiError } from '@/api/client';
import { shareTravel } from '@/utils/shareTravel';

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
  coordsMeTravel: [{ lat: 0, lng: 0, categories: ['1'], address: 'Rynek 5' }],
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
    ;(fetchFacebookPublishStatus as jest.Mock).mockReset();
    ;(fetchFacebookOAuthStartUrl as jest.Mock).mockReset();
    ;(publishTravelToFacebook as jest.Mock).mockReset();
    ;(fetchFacebookPublishStatus as jest.Mock).mockResolvedValue({
      configured: true,
      connected: true,
      pageId: 'server-page-id',
      pageName: 'MeTravel',
      canPublish: true,
    });
    ;(fetchFacebookOAuthStartUrl as jest.Mock).mockResolvedValue(
      'https://www.facebook.com/v25.0/dialog/oauth?client_id=test-app',
    );
    ;(publishTravelToFacebook as jest.Mock).mockResolvedValue({
      status: 'published',
      postUrl: 'https://www.facebook.com/test-post',
    });
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

  it('opens generic share with the saved public travel slug', async () => {
    const screen = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={{ ...baseFormData, publication_status: 'published', publish: true, moderation: true }}
        setFormData={jest.fn()}
        isSuperAdmin={false}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('travel-publish-share-button'));
    });

    expect(shareTravel).toHaveBeenCalledWith({ id: 'test', title: 'Test travel' });
  });

  it('does not expose sharing for a private draft', () => {
    const screen = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={{ ...baseFormData, publish: false }}
        setFormData={jest.fn()}
        isSuperAdmin={false}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    expect(screen.queryByTestId('travel-publish-share-button')).toBeNull();
  });

  it('sends an explicit submit command without changing confirmed state', async () => {
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

    expect(setFormData).not.toHaveBeenCalled();
    expect(onManualSave).toHaveBeenCalledWith(baseFormData, { intent: 'submit' });
  }, 15000);

  it('admin approve uses its own command without an optimistic state change', async () => {
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

    expect(setFormData).not.toHaveBeenCalled();
    expect(onManualSave).toHaveBeenCalledWith(adminData, { intent: 'approve' });

    expect(onFinish).not.toHaveBeenCalled();
  });

  // Прод, travel/619: у трёх точек из восьми не было категорий. Бэк отвечал 400
  // со структурой `{coordsMeTravel: [{index, id, address, field, message}]}`, FE
  // показывал безликую ошибку, и пользователь не мог понять, почему не публикуется.
  // Теперь блокируем до запроса и называем проблемные точки.
  it('blocks the admin approve when a route point has no category', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const setFormData = jest.fn();

    const adminData: TravelFormData = {
      ...baseFormData,
      publish: true,
      moderation: false,
      coordsMeTravel: [
        { lat: 0, lng: 0, categories: ['1'], address: 'Rynek 5' },
        { lat: 1, lng: 1, categories: [], address: 'Zabrzańska 5 \u00b7 Бытом' },
      ],
    };

    const { getByText, findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={adminData}
        setFormData={setFormData}
        isSuperAdmin={true}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    await act(async () => {
      fireEvent.press(getByText('Одобрить модерацию'));
    });

    expect(onManualSave).not.toHaveBeenCalled();
    expect(setFormData).not.toHaveBeenCalled();
    expect(await findByText(/Zabrzańska 5/)).toBeTruthy();
    // Чек-лист готовности показывает пункт ещё до нажатия — пользователь видит
    // недостающие категории точек, не дожидаясь отказа.
    expect(getByText('Категории у точек маршрута')).toBeTruthy();
  });

  it('blocks the user moderation submit when a route point has no category', async () => {
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const setFormData = jest.fn();

    const { getByText, getByTestId, findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={{
          ...baseFormData,
          coordsMeTravel: [{ lat: 0, lng: 0, categories: [], address: 'Rynek 5' }],
        }}
        setFormData={setFormData}
        isSuperAdmin={false}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const moderationRow = getByText('Отправить на модерацию').parent?.parent;
    if (!moderationRow) throw new Error('Moderation option row not found');
    await act(async () => {
      fireEvent.press(moderationRow);
    });
    await act(async () => {
      fireEvent.press(getByTestId('primary-button'));
    });

    expect(onManualSave).not.toHaveBeenCalled();
    expect(await findByText(/Rynek 5/)).toBeTruthy();
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
    expect(queryByText('Публикация в Facebook')).toBeNull();
  });

  it('shows Facebook publishing only after the backend confirms capability', async () => {
    const { findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    expect(await findByText('Публикация в Facebook')).toBeTruthy();
    expect(await findByText('Опубликовать в Facebook')).toBeTruthy();
    expect(fetchFacebookPublishStatus).toHaveBeenCalledTimes(1);
  });

  it('refreshes Facebook capability when the web tab regains focus after OAuth', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    ;(fetchFacebookPublishStatus as jest.Mock)
      .mockResolvedValueOnce({
        configured: true,
        connected: false,
        pageId: null,
        pageName: null,
        canPublish: false,
      })
      .mockResolvedValueOnce({
        configured: true,
        connected: true,
        pageId: 'server-page-id',
        pageName: 'MeTravel',
        canPublish: true,
      });

    try {
      const { findByText } = render(
        <TravelWizardStepPublish
          currentStep={6}
          totalSteps={6}
          formData={baseFormData}
          setFormData={jest.fn()}
          isSuperAdmin={true}
          onManualSave={jest.fn()}
          onGoBack={jest.fn()}
          onFinish={jest.fn()}
        />
      );

      expect(await findByText('Подключить Facebook')).toBeTruthy();
      expect(fetchFacebookPublishStatus).toHaveBeenCalledTimes(1);

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });

      expect(await findByText('MeTravel: Готово к публикации')).toBeTruthy();
      expect(fetchFacebookPublishStatus).toHaveBeenCalledTimes(2);
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('keeps Facebook action hidden when capability lookup fails', async () => {
    ;(fetchFacebookPublishStatus as jest.Mock).mockRejectedValueOnce(new Error('Not deployed'));
    const { queryByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    await act(async () => undefined);
    expect(queryByText('Публикация в Facebook')).toBeNull();
  });

  it('opens backend Facebook OAuth when the Page is not connected', async () => {
    ;(fetchFacebookPublishStatus as jest.Mock).mockResolvedValueOnce({
      configured: true,
      connected: false,
      pageId: 'server-page-id',
      pageName: 'MeTravel',
      canPublish: false,
    });
    const { findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const connectButton = await findByText('Подключить Facebook');
    await act(async () => {
      fireEvent.press(connectButton);
    });

    expect(fetchFacebookOAuthStartUrl).toHaveBeenCalledTimes(1);
    expect(openExternalUrl).toHaveBeenCalledWith(
      'https://www.facebook.com/v25.0/dialog/oauth?client_id=test-app',
    );
  });

  it('publishes an edited Facebook message with the default selected gallery photo', async () => {
    const { findByText, findByLabelText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    fireEvent.changeText(await findByLabelText('Текст поста для Facebook'), 'Новый Facebook текст');
    const publishButton = await findByText('Опубликовать в Facebook');
    await act(async () => {
      fireEvent.press(publishButton);
    });

    expect(publishTravelToFacebook).toHaveBeenCalledWith(640, 'Новый Facebook текст', [
      {
        id: 1,
        url: 'https://example.com/gallery-1.jpg',
        caption: undefined,
      },
    ]);
    expect(await findByText('MeTravel: Пост опубликован')).toBeTruthy();
  });

  it('honors an explicit choice to publish without the default gallery photo', async () => {
    const { findByText, findByLabelText, findByTestId } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    fireEvent.changeText(await findByLabelText('Текст поста для Facebook'), 'Текст без фото');
    const selectedPhoto = await findByTestId('facebook-photo-0');
    expect(selectedPhoto.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );

    await act(async () => {
      fireEvent.press(selectedPhoto);
    });

    expect((await findByTestId('facebook-photo-0')).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
    const publishButton = await findByText('Опубликовать в Facebook');
    await act(async () => {
      fireEvent.press(publishButton);
    });

    expect(publishTravelToFacebook).toHaveBeenCalledWith(640, 'Текст без фото', []);
  });

  it('publishes Facebook photos in the order they were picked, not in gallery order', async () => {
    const multiPhotoFormData: TravelFormData = {
      ...baseFormData,
      gallery: [
        { id: 1, url: 'https://example.com/gallery-1.jpg' },
        { id: 2, url: 'https://example.com/gallery-2.jpg' },
        { id: 3, url: 'https://example.com/gallery-3.jpg' },
      ],
    };
    const { findByText, findByLabelText, findByTestId } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={multiPhotoFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    fireEvent.changeText(await findByLabelText('Текст поста для Facebook'), 'Свой порядок фото');
    // Clear the default selection, then pick the last photo first.
    for (const index of [0, 1, 2]) {
      await act(async () => {
        fireEvent.press(await findByTestId(`facebook-photo-${index}`));
      });
    }
    for (const index of [2, 0]) {
      await act(async () => {
        fireEvent.press(await findByTestId(`facebook-photo-${index}`));
      });
    }

    await act(async () => {
      fireEvent.press(await findByText('Опубликовать в Facebook'));
    });

    expect(publishTravelToFacebook).toHaveBeenCalledWith(640, 'Свой порядок фото', [
      { id: 3, url: 'https://example.com/gallery-3.jpg', caption: undefined },
      { id: 1, url: 'https://example.com/gallery-1.jpg', caption: undefined },
    ]);
  });

  it('accepts ten Facebook photos, disables an eleventh, and keeps deselection available', async () => {
    const gallery = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      url: `https://example.com/gallery-${index + 1}.jpg`,
    }));
    const { findByText, findByLabelText, findByTestId } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={{ ...baseFormData, gallery }}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    fireEvent.changeText(await findByLabelText('Текст поста для Facebook'), 'Десять фото');
    for (let index = 4; index < 10; index += 1) {
      await act(async () => {
        fireEvent.press(await findByTestId(`facebook-photo-${index}`));
      });
    }

    expect(await findByText('10 из 12 выбрано · лимит 10')).toBeTruthy();
    expect(await findByTestId('facebook-photo-limit-feedback')).toBeTruthy();
    expect((await findByTestId('facebook-photo-10')).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false, disabled: true }),
    );
    expect((await findByTestId('facebook-photo-0')).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true, disabled: false }),
    );

    await act(async () => {
      fireEvent.press(await findByText('Опубликовать в Facebook'));
    });
    expect(publishTravelToFacebook).toHaveBeenCalledWith(
      640,
      'Десять фото',
      gallery.slice(0, 10).map((photo) => ({
        id: photo.id,
        url: photo.url,
        caption: undefined,
      })),
    );

    await act(async () => {
      fireEvent.press(await findByTestId('facebook-photo-0'));
    });
    expect((await findByTestId('facebook-photo-10')).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
  });

  it('shows duplicate state and opens the backend-provided post URL', async () => {
    ;(publishTravelToFacebook as jest.Mock).mockResolvedValueOnce({
      status: 'already_published',
      duplicate: true,
      postUrl: 'https://www.facebook.com/existing-post',
    });
    const { findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const publishButton = await findByText('Опубликовать в Facebook');
    await act(async () => {
      fireEvent.press(publishButton);
    });
    expect(await findByText('MeTravel: Эта статья уже опубликована')).toBeTruthy();

    const openPostButton = await findByText('Открыть пост в Facebook');
    await act(async () => {
      fireEvent.press(openPostButton);
    });
    expect(openExternalUrl).toHaveBeenCalledWith('https://www.facebook.com/existing-post');
  });

  it('treats a publish timeout as pending instead of a failure', async () => {
    const timeoutError = new Error('Превышено время ожидания (100000ms)');
    timeoutError.name = 'TimeoutError';
    ;(publishTravelToFacebook as jest.Mock).mockRejectedValueOnce(timeoutError);
    const { findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const publishButton = await findByText('Опубликовать в Facebook');
    await act(async () => {
      fireEvent.press(publishButton);
    });

    expect(await findByText('MeTravel: Пост, возможно, ещё публикуется')).toBeTruthy();
    // Повторно слать нельзя — это внешняя публикация, дубль необратим.
    expect(publishTravelToFacebook).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'info',
        text1: 'Публикация занимает больше времени, чем обычно',
      }),
    );
  });

  it('guards Facebook publish until the travel has been saved', async () => {
    const { findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={{ ...baseFormData, id: undefined }}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const publishButton = await findByText('Опубликовать в Facebook');
    await act(async () => {
      fireEvent.press(publishButton);
    });

    expect(publishTravelToFacebook).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Сначала сохраните путешествие' }),
    );
  });

  it('prevents a double Facebook publish submission', async () => {
    let resolvePublish: ((value: { status: 'published' }) => void) | undefined;
    ;(publishTravelToFacebook as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => { resolvePublish = resolve; }),
    );
    const { findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const publishButton = await findByText('Опубликовать в Facebook');
    fireEvent.press(publishButton);
    fireEvent.press(publishButton);
    expect(publishTravelToFacebook).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePublish?.({ status: 'published' });
    });
  });

  it('returns Facebook publishing to not-connected state after a 409 response', async () => {
    ;(publishTravelToFacebook as jest.Mock).mockRejectedValueOnce(
      new ApiError(409, 'Facebook Page is not connected'),
    );
    const { findByText } = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={baseFormData}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={jest.fn()}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    const publishButton = await findByText('Опубликовать в Facebook');
    await act(async () => {
      fireEvent.press(publishButton);
    });

    expect(await findByText('MeTravel: Страница Facebook не подключена')).toBeTruthy();
    expect(await findByText('Подключить Facebook')).toBeTruthy();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Сначала подключите страницу Facebook' }),
    );
  });

  it.each([400, 403, 503])(
    'shows the Facebook error state and toast after HTTP %s',
    async (status) => {
      ;(publishTravelToFacebook as jest.Mock).mockRejectedValueOnce(
        new ApiError(status, `Facebook publish failed: ${status}`),
      );
      const { findByText } = render(
        <TravelWizardStepPublish
          currentStep={6}
          totalSteps={6}
          formData={baseFormData}
          setFormData={jest.fn()}
          isSuperAdmin={true}
          onManualSave={jest.fn()}
          onGoBack={jest.fn()}
          onFinish={jest.fn()}
        />
      );

      const publishButton = await findByText('Опубликовать в Facebook');
      await act(async () => {
        fireEvent.press(publishButton);
      });

      expect(await findByText('MeTravel: Произошла ошибка. Повторите попытку.')).toBeTruthy();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ text1: 'Не удалось опубликовать в Facebook' }),
      );
    },
  );

  it('opens Meta OAuth from the backend when superadmin presses connect', async () => {
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
      fireEvent.press(getByText('Подключить Instagram'));
    });

    expect(fetchInstagramOAuthStartUrl).toHaveBeenCalled();
    expect(openExternalUrl).toHaveBeenCalledWith('https://www.facebook.com/v19.0/dialog/oauth?client_id=test-app');
    expect(showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
      })
    );
  });

  it('publishes to Instagram via the API when superadmin presses publish', async () => {
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
        accountKey: expect.any(String),
        imageUrls: expect.arrayContaining(['https://example.com/gallery-1.jpg']),
      })
    );
    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
      })
    );
  });

  it('allows editing instagram caption and hashtags before oauth launch', async () => {
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

    expect(getByLabelText('Текст поста для Instagram').props.value).toBe('Новый caption');
    expect(getByLabelText('Хэштеги для Instagram').props.value).toBe('#metravelby #польша #краков');
    expect(getByText('Длина текста: 13. Максимум символов в caption с тегами: 2200.')).toBeTruthy();
  });

  it('keeps manual instagram image reorder controls working', async () => {
    const { getByTestId } = render(
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

    expect(getByTestId('instagram-move-left-1')).toBeTruthy();
  });

  it('keeps instagram image removal controls working', async () => {
    const { getByTestId, getAllByTestId } = render(
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
  });

  it('shows config error when the backend has no OAuth url (not configured)', async () => {
    ;(fetchInstagramOAuthStartUrl as jest.Mock).mockResolvedValueOnce('')

    const { getByText } = render(
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

    await act(async () => {
      fireEvent.press(getByText('Подключить Instagram'));
    });

    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text1: 'Instagram не настроен на сервере',
      })
    );
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

  it.each(['pending_review', 'approved', 'published'] as const)('ordinary save preserves %s', async (publication_status) => {
    const data = { ...baseFormData, publication_status, publish: false, moderation: false };
    const onManualSave = jest.fn().mockResolvedValue(data);
    const setFormData = jest.fn();
    const screen = render(<TravelWizardStepPublish currentStep={6} totalSteps={6}
      formData={data} setFormData={setFormData} isSuperAdmin={false}
      onManualSave={onManualSave} onGoBack={jest.fn()} onFinish={jest.fn()} />);
    await act(async () => fireEvent.press(screen.getByTestId('primary-button')));
    expect(onManualSave).toHaveBeenCalledWith(data, { intent: 'save' });
    expect(setFormData).not.toHaveBeenCalled();
  });

  it('shows pending state and admin actions immediately for false/false legacy flags', () => {
    const data = { ...baseFormData, publication_status: 'pending_review', publish: false, moderation: false };
    const screen = render(<TravelWizardStepPublish currentStep={6} totalSteps={6}
      formData={data} setFormData={jest.fn()} isSuperAdmin
      onManualSave={jest.fn()} onGoBack={jest.fn()} onFinish={jest.fn()} />);
    expect(screen.getByText('Отправлено на модерацию')).toBeTruthy();
    expect(screen.getByText('Одобрить модерацию')).toBeTruthy();
    expect(screen.queryByText('Черновик')).toBeNull();
  });

  it('shows an unsupported canonical state error and blocks writes without discarding content', () => {
    const onManualSave = jest.fn();
    const data = { ...baseFormData, publication_status: 'future_state' };
    const screen = render(<TravelWizardStepPublish currentStep={6} totalSteps={6}
      formData={data} setFormData={jest.fn()} isSuperAdmin
      onManualSave={onManualSave} onGoBack={jest.fn()} onFinish={jest.fn()} />);
    expect(screen.getAllByText(/Неизвестное состояние публикации/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('primary-button'));
    expect(onManualSave).not.toHaveBeenCalled();
    expect(screen.queryByText('Одобрить модерацию')).toBeNull();
    expect(data.description).toBe(baseFormData.description);
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

  it.each(['', '  \n  '])('blocks rejecting with an empty reason (%p)', async (comment) => {
    const onManualSave = jest.fn();
    const screen = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={{ ...baseFormData, publish: true, moderation: false }}
        setFormData={jest.fn()}
        isSuperAdmin={true}
        onManualSave={onManualSave}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );

    fireEvent.changeText(screen.getByLabelText('Комментарий при отклонении'), comment);
    const reject = screen.getByLabelText('Отклонить модерацию');
    expect(reject.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    expect(screen.getByText('Укажите причину отклонения')).toBeTruthy();
    fireEvent.press(reject);
    expect(onManualSave).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Отклонить')).toBeNull();
  });

  it('reject click sends its trimmed reason once without putting the signal in form state', async () => {
    const onManualSave = jest.fn().mockResolvedValue({ ...baseFormData, publish: false, moderation: false });
    const onFinish = jest.fn();
    const setFormData = jest.fn();

    const adminData: TravelFormData = {
      ...baseFormData,
      publish: true,
      moderation: false,
    };

    const { getByLabelText } = render(
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

    fireEvent.changeText(getByLabelText('Комментарий при отклонении'), '  нет фото  ');
    expect(getByLabelText('Комментарий при отклонении').props.maxLength).toBe(2000);
    await act(async () => {
      fireEvent.press(getByLabelText('Отклонить модерацию'));
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Отклонить'));
      fireEvent.press(getByLabelText('Отклонить'));
    });

    expect(onManualSave).toHaveBeenCalledTimes(1);
    expect(onManualSave).toHaveBeenCalledWith(adminData,
      { intent: 'reject', moderationDecisionReason: 'нет фото' });
    expect(setFormData).not.toHaveBeenCalled();

    expect(onFinish).not.toHaveBeenCalled();
  });

  it('keeps the rejection reason and restores pending status when saving rejection fails', async () => {
    const adminData = { ...baseFormData, publish: true, moderation: false };
    const setFormData = jest.fn();
    const screen = render(
      <TravelWizardStepPublish
        currentStep={6}
        totalSteps={6}
        formData={adminData}
        setFormData={setFormData}
        isSuperAdmin={true}
        onManualSave={jest.fn().mockRejectedValue(new Error('Network error'))}
        onGoBack={jest.fn()}
        onFinish={jest.fn()}
      />
    );
    fireEvent.changeText(screen.getByLabelText('Комментарий при отклонении'), 'нет фото');
    fireEvent.press(screen.getByLabelText('Отклонить модерацию'));
    await act(async () => fireEvent.press(screen.getByLabelText('Отклонить')));

    expect(setFormData).not.toHaveBeenCalled();
    expect(adminData.publish).toBe(true);
    await waitFor(() => {
      expect(screen.getByLabelText('Комментарий при отклонении').props.value).toBe('нет фото');
    });
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it.each(['cancelled', 'failed'] as const)('preserves live content and reason when rejection is %s', async (outcome) => {
    const adminData = { ...baseFormData, publish: true, moderation: false, userId: 42 };
    let live: TravelFormData = adminData;
    const setFormData = jest.fn((update: React.SetStateAction<TravelFormData>) => {
      live = typeof update === 'function' ? update(live) : update;
    });
    const onManualSave = jest.fn(async () => {
      // A save already in flight completes while rejection waits for its turn.
      live = { ...live, categories: ['1', '2'], description: 'Newer content' };
      if (outcome === 'failed') throw new Error('Save failed');
    });
    const { result } = renderHook(() => useTravelPublishModeration({
      formData: adminData,
      setFormData,
      onManualSave,
      currentStep: 6,
      isSuperAdmin: true,
      routePoints: adminData.coordsMeTravel,
      galleryItems: adminData.gallery ?? [],
      checklist: [],
    }));
    act(() => result.current.setRejectionComment('Add photos'));

    await act(async () => { await result.current.handleRejectModeration(); });

    expect(live).toEqual(expect.objectContaining({
      publish: true,
      moderation: false,
      categories: ['1', '2'],
      description: 'Newer content',
    }));
    expect(result.current.rejectionComment).toBe('Add photos');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
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

    expect(setFormData).not.toHaveBeenCalled();
    expect(onManualSave).toHaveBeenCalledWith(baseFormData, { intent: 'submit' });
    expect(showToast).toHaveBeenCalledWith({
      type: 'error',
      text1: 'Не удалось отправить',
      text2: 'Network error',
    });
  });

  it.each(['submit', 'approve'] as const)('does not announce success or leave after cancelled %s', async (intent) => {
    const data = { ...baseFormData, publication_status: intent === 'submit' ? 'draft' : 'pending_review' };
    const onManualSave = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTravelPublishModeration({
      formData: data, setFormData: jest.fn(), onManualSave,
      currentStep: 6, isSuperAdmin: intent === 'approve',
      routePoints: data.coordsMeTravel, galleryItems: data.gallery ?? [], checklist: [],
    }));
    if (intent === 'submit') act(() => result.current.setStatus('moderation'));
    await act(async () => {
      if (intent === 'submit') result.current.handlePrimaryAction();
      else await result.current.handleApproveModeration();
    });
    expect(onManualSave).toHaveBeenCalledWith(data, { intent });
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    expect(result.current.publicationStatus).toBe(data.publication_status);
  });

});

describe('author rejection feedback in the existing wizard', () => {
  const rejectedData: TravelFormData = { ...baseFormData, publication_status: 'draft',
    moderation_decision: 'rejected', moderation_decision_reason: 'Добавьте фотографию точки маршрута',
    moderation_decided_at: '2026-10-22T12:00:00Z' };
  beforeEach(() => jest.clearAllMocks());

  it('correction navigates to editing without saving, selecting submission, or clearing the decision', () => {
    const onStepSelect = jest.fn();
    const onManualSave = jest.fn();
    const setFormData = jest.fn();
    const screen = render(<TravelWizardStepPublish currentStep={6} totalSteps={6} formData={rejectedData} moderationFeedbackContextKey="640:u1"
      setFormData={setFormData} isSuperAdmin={false} onManualSave={onManualSave}
      onGoBack={jest.fn()} onFinish={jest.fn()} onStepSelect={onStepSelect} />);
    fireEvent.press(screen.getByTestId('moderation-correct-button'));
    expect(onStepSelect).toHaveBeenCalledWith(1);
    expect(onManualSave).not.toHaveBeenCalled();
    expect(setFormData).not.toHaveBeenCalled();
    expect(screen.getByText('Отклонено')).toBeTruthy();
    expect(rejectedData.moderation_decision_reason).toBe('Добавьте фотографию точки маршрута');
  });

  it('hides private decision metadata synchronously when the viewer context is denied', () => {
    const props = { currentStep: 6, totalSteps: 6, formData: rejectedData,
      setFormData: jest.fn(), isSuperAdmin: false, onManualSave: jest.fn(), onGoBack: jest.fn(), onFinish: jest.fn() };
    const screen = render(<TravelWizardStepPublish {...props} moderationFeedbackContextKey="640:u1" />);
    expect(screen.getByText('Отклонено')).toBeTruthy();
    expect(screen.getByTestId('moderation-reason-preview')).toBeTruthy();
    screen.rerender(<TravelWizardStepPublish {...props} moderationFeedbackContextKey={null} />);
    expect(screen.getByText('Черновик')).toBeTruthy();
    expect(screen.queryByText('Отклонено')).toBeNull();
    expect(screen.queryByTestId('moderation-reason-preview')).toBeNull();
    expect(screen.queryByTestId('moderation-decision-date')).toBeNull();
    expect(screen.queryByTestId('moderation-correct-button')).toBeNull();
    expect(props.onManualSave).not.toHaveBeenCalled();
  });

  it('denies private metadata by default even when stale form data includes a rejection', () => {
    const screen = render(<TravelWizardStepPublish currentStep={6} totalSteps={6} formData={rejectedData}
      setFormData={jest.fn()} isSuperAdmin={false} onManualSave={jest.fn()} onGoBack={jest.fn()} onFinish={jest.fn()} />);
    expect(screen.getByText('Черновик')).toBeTruthy();
    expect(screen.queryByText('Отклонено')).toBeNull();
    expect(screen.queryByTestId('moderation-reason-preview')).toBeNull();
  });

  it('failed explicit resubmission keeps the reason and allows a retry', async () => {
    const onManualSave = jest.fn().mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce(undefined);
    const screen = render(<TravelWizardStepPublish currentStep={6} totalSteps={6} formData={rejectedData} moderationFeedbackContextKey="640:u1"
      setFormData={jest.fn()} isSuperAdmin={false} onManualSave={onManualSave} onGoBack={jest.fn()} onFinish={jest.fn()} />);
    const moderationRow = screen.getByText('Отправить на модерацию').parent?.parent;
    if (!moderationRow) throw new Error('Moderation option row not found');
    fireEvent.press(moderationRow);
    await act(async () => fireEvent.press(screen.getByTestId('primary-button')));
    expect(onManualSave).toHaveBeenCalledWith(rejectedData, { intent: 'submit' });
    expect(screen.getByTestId('moderation-reason-preview').props.children).toBe(rejectedData.moderation_decision_reason);
    expect(screen.getByText('Отклонено')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('primary-button')));
    expect(onManualSave).toHaveBeenCalledTimes(2);
    expect(rejectedData.description).toBe(baseFormData.description);
  });
});
