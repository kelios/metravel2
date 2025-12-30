import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AboutScreen from '@/app/(tabs)/about';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { sendFeedback } from '@/src/api/misc';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/src/api/misc', () => ({
  ...jest.requireActual('@/src/api/misc'),
  sendFeedback: jest.fn(),
}));

jest.mock('@/components/seo/InstantSEO', () => () => null);

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ width: 1200, isPhone: false, isLargePhone: false }),
}));

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Linking: {
      openURL: jest.fn(() => Promise.resolve()),
      canOpenURL: jest.fn(() => Promise.resolve(true)),
    },
  };
});

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
  });

  it('renders hero and feature sections', () => {
    const { getByText } = render(<AboutScreen />);

    expect(getByText('MeTravel.by')).toBeTruthy();
    expect(getByText('Сообщество путешественников')).toBeTruthy();
    expect(getByText('Функции и возможности')).toBeTruthy();
    expect(getByText('Доступно сейчас')).toBeTruthy();
    expect(getByText('В разработке')).toBeTruthy();
  });

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

  it('shows web keyboard hint in contact form', () => {
    const { getByText } = render(<AboutScreen />);
    expect(getByText('Shift+Enter — новая строка, Enter — отправить (web)')).toBeTruthy();
  });

  it('opens instagram from social section', async () => {
    const { getByText } = render(<AboutScreen />);
    const instaButton = getByText('@metravelby');
    fireEvent.press(instaButton);

    const { Linking } = require('react-native');
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith('https://instagram.com/metravelby');
    });
  });
});
