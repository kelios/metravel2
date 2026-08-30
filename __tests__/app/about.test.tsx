import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AboutScreen from '@/app/(tabs)/about';
import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { sendFeedback } from '@/api/misc';
import { openExternalUrl } from '@/utils/externalLinks';
import { GOOGLE_PLAY_APP_URL } from '@/constants/appStore';
import { trackAppDownloadClicked } from '@/utils/growthFunnelAnalytics';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useIsFocused: jest.fn(),
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

jest.mock('@/components/seo/InstantSEO', () => () => null);

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

  it('renders hero and feature sections', () => {
    const { getByText, getByTestId, queryByText } = render(<AboutScreen />);

    expect(getByText('MeTravel.by')).toBeTruthy();
    expect(getByText('Путешествия, которые хочется повторить')).toBeTruthy();
    expect(getByText('Функции и возможности')).toBeTruthy();
    expect(getByText('Доступно сейчас')).toBeTruthy();
    expect(getByText('В разработке')).toBeTruthy();
    const currentFeatures = getByTestId('about-current-features');
    const roadmapFeatures = getByTestId('about-roadmap-features');
    const androidCopy = 'Приложение MeTravel для Android доступно в Google Play';
    const offlineCopy =
      'Выбранные маршруты, статьи, квесты и области карты можно сохранить для работы офлайн в приложении';
    const iosCopy = 'Версия приложения для iOS';

    expect(within(currentFeatures).getByText(androidCopy)).toBeTruthy();
    expect(within(currentFeatures).getByText(offlineCopy)).toBeTruthy();
    expect(within(currentFeatures).queryByText(iosCopy)).toBeNull();
    expect(within(roadmapFeatures).getByText(iosCopy)).toBeTruthy();
    expect(within(roadmapFeatures).queryByText(androidCopy)).toBeNull();
    expect(within(roadmapFeatures).queryByText(offlineCopy)).toBeNull();
    expect(queryByText('Мобильное приложение для iOS и Android')).toBeNull();
    expect(queryByText('Офлайн-режим для просмотра сохраненных маршрутов')).toBeNull();
  });

  it('opens the public Android listing from the web feature card', async () => {
    (Platform as { OS: string }).OS = 'web';

    const { getByTestId } = render(<AboutScreen />);
    fireEvent.press(getByTestId('about-google-play-cta'));

    expect(mockTrackAppDownloadClicked).toHaveBeenCalledWith({ source: 'about_page' });
    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        GOOGLE_PLAY_APP_URL,
        expect.objectContaining({ onError: expect.any(Function) }),
      );
    });
  });

  it.each(['android', 'ios'] as const)(
    'does not render a Google Play CTA inside the %s about screen',
    (os) => {
      (Platform as { OS: string }).OS = os;

      const { queryByTestId } = render(<AboutScreen />);

      expect(queryByTestId('about-google-play-cta')).toBeNull();
    },
  );

  it('submits contact form with valid data', async () => {
    mockSendFeedback.mockResolvedValueOnce('Сообщение успешно отправлено');
    const { getByPlaceholderText, getByText } = render(<AboutScreen />);

    fireEvent.changeText(getByPlaceholderText('Имя'), 'Alice');
    fireEvent.changeText(getByPlaceholderText('Email'), 'alice@example.com');
    fireEvent.changeText(getByPlaceholderText('Сообщение'), 'Hello!');

    fireEvent.press(getByText('Согласен(на) на обработку персональных данных'));
    fireEvent.press(getByText('Отправить'));

    await waitFor(() => {
      expect(mockSendFeedback).toHaveBeenCalledWith('Alice', 'alice@example.com', 'Hello!');
    });
    await waitFor(() => {
      expect(getByText(/Сообщение успешно отправлено/i)).toBeTruthy();
    });
  });

  it('exposes exactly one page heading, without the "| Metravel" tab-title suffix (#1610)', () => {
    (Platform as { OS: string }).OS = 'web';

    const { getAllByRole, getByText, UNSAFE_root } = render(<AboutScreen />);

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
    expect(UNSAFE_root.findAll((node) => node.type === 'h1')).toHaveLength(0);
  });

  it('shows web keyboard hint in contact form', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Shift+Enter — новая строка, Enter — отправить (web)')).toBeTruthy();
  });

  it('opens instagram from social section', async () => {
    const { getByText } = render(<AboutScreen />);
    const instaButton = getByText('@metravelby');
    fireEvent.press(instaButton);

    await waitFor(() => {
      expect(mockOpenExternalUrl).toHaveBeenCalledWith(
        'https://www.instagram.com/metravelby/',
        expect.any(Object),
      );
    });
  });
});
