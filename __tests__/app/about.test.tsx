import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AboutScreen from '@/app/(tabs)/about';
import ContactScreen from '@/app/contact';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { sendFeedback } from '@/api/misc';
import { openExternalUrl } from '@/utils/externalLinks';
import { APP_STORE_APP_URL, GOOGLE_PLAY_APP_URL } from '@/constants/appStore';
import { trackAppDownloadClicked } from '@/utils/growthFunnelAnalytics';
import { showToast } from '@/utils/toast';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useIsFocused: jest.fn(),
  useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, [cb]),
}));

jest.mock('@/api/misc', () => ({
  ...jest.requireActual('@/api/misc'),
  sendFeedback: jest.fn(),
}));

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@/utils/growthFunnelAnalytics', () => ({
  trackAppDownloadClicked: jest.fn(),
}));

jest.mock('@/components/layout/CustomHeader', () => () => null);
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ width: 1200, isPhone: false, isLargePhone: false }),
}));

jest.mock('@expo/vector-icons', () => ({
  FontAwesome5: ({ name, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `fa5-${name}`, ...props });
  },
}));

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockImageCardMedia(props: any) {
    return React.createElement(View, { testID: 'image-card-media', ...props });
  };
});

const mockUseIsFocused = useIsFocused as jest.MockedFunction<typeof useIsFocused>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockSendFeedback = sendFeedback as jest.MockedFunction<typeof sendFeedback>;
const mockShowToast = showToast as jest.MockedFunction<typeof showToast>;
const mockOpenExternalUrl = openExternalUrl as jest.MockedFunction<typeof openExternalUrl>;
const mockTrackAppDownloadClicked = trackAppDownloadClicked as jest.MockedFunction<
  typeof trackAppDownloadClicked
>;
const originalPlatformOS = Platform.OS;

describe('AboutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsFocused.mockReturnValue(true);
    mockUseRouter.mockReturnValue({
      push: jest.fn(),
    } as any);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
    (Platform as { OS: string }).OS = originalPlatformOS;
  });

  it('renders hero and feature sections', async () => {
    (Platform as { OS: string }).OS = 'web';
    const { getByText, getByTestId, queryByText } = await render(<AboutScreen />);

    expect(getByText('MeTravel.by')).toBeTruthy();
    expect(getByText('Путешествия, которые хочется повторить')).toBeTruthy();
    expect(getByText('Функции и возможности')).toBeTruthy();
    expect(getByText('Доступно сейчас')).toBeTruthy();
    expect(getByText('В разработке')).toBeTruthy();
    const currentFeatures = getByTestId('about-current-features');
    const roadmapFeatures = getByTestId('about-roadmap-features');
    const appsCopy = 'Приложение MeTravel для iPhone, iPad и Android — в App Store и Google Play';
    const offlineCopy =
      'Выбранные маршруты, статьи, квесты и области карты можно сохранить для работы офлайн в приложении';

    expect(within(currentFeatures).getByText(appsCopy)).toBeTruthy();
    expect(within(currentFeatures).getByText(offlineCopy)).toBeTruthy();
    // iOS вышел 19.10.2026 (#2655): в roadmap его больше нет.
    expect(within(roadmapFeatures).queryByText('Версия приложения для iOS')).toBeNull();
    expect(within(roadmapFeatures).queryByText(appsCopy)).toBeNull();
    expect(within(roadmapFeatures).queryByText(offlineCopy)).toBeNull();
    expect(queryByText('Мобильное приложение для iOS и Android')).toBeNull();
    expect(queryByText('Офлайн-режим для просмотра сохраненных маршрутов')).toBeNull();
  });

  it.each([
    ['ios', APP_STORE_APP_URL],
    ['android', GOOGLE_PLAY_APP_URL],
  ] as const)('opens the public %s listing from the web feature card', async (platform, url) => {
    (Platform as { OS: string }).OS = 'web';

    const { getByTestId } = await render(<AboutScreen />);
    await fireEvent.press(getByTestId(`about-store-buttons-${platform}`));

    expect(mockTrackAppDownloadClicked).toHaveBeenCalledWith({ source: 'about_page', platform });
    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });
  });

  it.each(['android', 'ios'] as const)(
    'does not render store CTAs inside the %s about screen',
    async (os) => {
      (Platform as { OS: string }).OS = os;

      const { queryByTestId, queryByText } = await render(<AboutScreen />);

      expect(queryByTestId('about-store-buttons')).toBeNull();
      expect(
        queryByText('Приложение MeTravel для iPhone, iPad и Android — в App Store и Google Play'),
      ).toBeNull();
    },
  );

  describe.each([
    ['about', AboutScreen],
    ['contact', ContactScreen],
  ] as const)('%s feedback form', (_route, Screen) => {
    async function fillAndSubmit() {
      const view = await render(<Screen />);
      await fireEvent.changeText(view.getByPlaceholderText('Имя'), 'Alice');
      await fireEvent.changeText(view.getByPlaceholderText('Email'), 'alice@example.com');
      await fireEvent.changeText(view.getByPlaceholderText('Сообщение'), 'Hello!');
      await fireEvent.press(view.getByText('Согласен(на) на обработку персональных данных'));
      await fireEvent.press(view.getByText('Отправить'));
      return view;
    }

    it('displays the returned confirmation and clears the submitted fields', async () => {
      const confirmation = 'Обращение принято: спасибо за ваше сообщение';
      mockSendFeedback.mockResolvedValueOnce(confirmation);
      const view = await fillAndSubmit();

      await waitFor(() => {
        expect(view.getByText(confirmation)).toBeTruthy();
      });
      expect(mockSendFeedback).toHaveBeenCalledTimes(1);
      expect(mockSendFeedback).toHaveBeenCalledWith('Alice', 'alice@example.com', 'Hello!');
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      expect(view.getByPlaceholderText('Имя').props.value).toBe('');
      expect(view.getByPlaceholderText('Email').props.value).toBe('');
      expect(view.getByPlaceholderText('Сообщение').props.value).toBe('');
    });

    it('displays a rejected error without reporting success or losing the draft', async () => {
      const errorMessage = 'Не удалось отправить сообщение';
      mockSendFeedback.mockRejectedValueOnce(new Error(errorMessage));
      const view = await fillAndSubmit();

      await waitFor(() => {
        expect(view.getByText(errorMessage)).toBeTruthy();
      });
      expect(mockSendFeedback).toHaveBeenCalledTimes(1);
      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
      expect(mockShowToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
      expect(view.getByPlaceholderText('Имя').props.value).toBe('Alice');
      expect(view.getByPlaceholderText('Email').props.value).toBe('alice@example.com');
      expect(view.getByPlaceholderText('Сообщение').props.value).toBe('Hello!');
    });
  });

  it('exposes exactly one page heading, without the "| Metravel" tab-title suffix (#1610)', async () => {
    (Platform as { OS: string }).OS = 'web';

    const { getAllByRole, getByText, container } = await render(<AboutScreen />);

    const heading = getByText('О проекте');
    expect(heading.props.accessibilityRole).toBe('header');
    expect(heading.props['aria-level']).toBe(1);

    const level1Headings = getAllByRole('header').filter(
      (node) => node.props['aria-level'] === 1,
    );
    expect(level1Headings.map((node) => String(node.props.children))).toEqual(['О проекте']);
    expect(String(heading.props.children)).not.toContain('Metravel');

    // The removed sr-only node was a raw JSX <h1>, not a React Native Text,
    // so the accessibility-role assertions above would not detect its return.
    expect(container.queryAll((node) => node.type === 'h1')).toHaveLength(0);
  });

  it('shows web keyboard hint in contact form', async () => {
    (Platform as { OS: string }).OS = 'web';
    const { getByText } = await render(<AboutScreen />);
    expect(getByText('Shift+Enter — новая строка, Enter — отправить (web)')).toBeTruthy();
  });

  it('opens instagram from social section', async () => {
    const { getByText } = await render(<AboutScreen />);
    const instaButton = getByText('@metravelby');
    await fireEvent.press(instaButton);

    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        'https://www.instagram.com/metravelby/',
        expect.any(Object),
      );
    });
  });
});
