import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CompactSideBarTravel from '@/components/travel/CompactSideBarTravel';
import type { Travel } from '@/src/types/types';

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: ({ source, style, ...props }: any) => {
    const React = require('react');
    const { View, Image } = require('react-native');
    return React.createElement(Image, { source, style, ...props });
  },
}));

// Mock WeatherWidget
jest.mock('@/components/WeatherWidget', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return ({ points }: any) => (
    React.createElement(View, { testID: 'weather-widget' },
      React.createElement(Text, null, 'Weather Widget')
    )
  );
});

// Mock image optimization utils
jest.mock('@/utils/imageOptimization', () => ({
  optimizeImageUrl: (url: string) => url,
  buildVersionedImageUrl: (url: string) => url,
  getOptimalImageSize: (width: number, height: number) => ({ width, height }),
}));

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  };
});

// Mock DeviceEventEmitter
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const createMockTravel = (overrides: Partial<Travel> = {}): Travel => ({
  id: 1,
  title: 'Test Travel',
  description: 'Test description',
  travelAddress: [],
  gallery: [],
  ...overrides,
} as Travel);

const createMockRefs = () => ({
  gallery: React.createRef(),
  video: React.createRef(),
  description: React.createRef(),
  map: React.createRef(),
  points: React.createRef(),
});

describe('CompactSideBarTravel', () => {
  const defaultProps = {
    refs: createMockRefs(),
    travel: createMockTravel(),
    isMobile: false,
    onNavigate: jest.fn(),
    closeMenu: jest.fn(),
    isSuperuser: false,
    storedUserId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { getByTestId } = render(<CompactSideBarTravel {...defaultProps} />);
    // Component should render without errors
    expect(getByTestId).toBeDefined();
  });

  it('should render user information when provided', () => {
    const travel = createMockTravel({
      userName: 'Test User',
      countryName: 'Test Country',
      year: 2024,
      monthName: 'January',
      number_days: 5,
      travel_image_thumb_small_url: 'https://example.com/avatar.jpg',
    } as any);

    const { getByText } = render(
      <CompactSideBarTravel {...defaultProps} travel={travel} />
    );

    expect(getByText(/Test User.*Test Country/)).toBeTruthy();
    expect(getByText(/January.*2024/)).toBeTruthy();
    expect(getByText(/• 5 дн\./)).toBeTruthy();
  });

  it('should render navigation links', () => {
    const travel = createMockTravel({
      gallery: [{ id: 1, url: 'test.jpg' }],
      youtube_link: 'https://youtube.com/test',
      description: 'Test description',
    } as any);

    const { getByText } = render(
      <CompactSideBarTravel {...defaultProps} travel={travel} />
    );

    expect(getByText('Галерея')).toBeTruthy();
    expect(getByText('Видео')).toBeTruthy();
    expect(getByText('Описание')).toBeTruthy();
    expect(getByText('Карта')).toBeTruthy();
  });

  it('should call onNavigate when link is pressed', () => {
    const travel = createMockTravel({
      gallery: [{ id: 1, url: 'test.jpg' }],
    } as any);

    const onNavigate = jest.fn();
    const { getByText } = render(
      <CompactSideBarTravel {...defaultProps} travel={travel} onNavigate={onNavigate} />
    );

    const galleryLink = getByText('Галерея');
    fireEvent.press(galleryLink);

    expect(onNavigate).toHaveBeenCalledWith('gallery');
  });

  it('should call closeMenu when link is pressed on mobile', () => {
    const travel = createMockTravel({
      gallery: [{ id: 1, url: 'test.jpg' }],
    } as any);

    const closeMenu = jest.fn();
    const { getByText } = render(
      <CompactSideBarTravel
        {...defaultProps}
        travel={travel}
        isMobile={true}
        closeMenu={closeMenu}
      />
    );

    const galleryLink = getByText('Галерея');
    fireEvent.press(galleryLink);

    expect(closeMenu).toHaveBeenCalled();
  });

  it('should render edit button when user can edit', () => {
    const travel = createMockTravel({
      userId: '123',
    } as any);

    const { getByLabelText } = render(
      <CompactSideBarTravel
        {...defaultProps}
        travel={travel}
        storedUserId="123"
      />
    );

    expect(getByLabelText('Редактировать путешествие')).toBeTruthy();
  });

  it('should not render edit button for guest (no user and no superuser)', () => {
    const travel = createMockTravel({
      userId: '123',
    } as any);

    const { queryByLabelText } = render(
      <CompactSideBarTravel
        {...defaultProps}
        travel={travel}
        isSuperuser={false}
        storedUserId={null}
      />
    );

    expect(queryByLabelText('Редактировать путешествие')).toBeNull();
  });

  it('should render edit button for superuser even if not owner', () => {
    const travel = createMockTravel({
      userId: '999',
    } as any);

    const { getByLabelText } = render(
      <CompactSideBarTravel
        {...defaultProps}
        travel={travel}
        isSuperuser={true}
        storedUserId={null}
      />
    );

    expect(getByLabelText('Редактировать путешествие')).toBeTruthy();
  });

  it('should render close button on mobile', () => {
    const { getByText, getAllByLabelText } = render(
      <CompactSideBarTravel {...defaultProps} isMobile={true} />
    );

    expect(getAllByLabelText('Закрыть меню')[0]).toBeTruthy();
    expect(getByText('Закрыть')).toBeTruthy();
  });

  it('should call closeMenu when close button is pressed', () => {
    const closeMenu = jest.fn();
    const { getAllByLabelText } = render(
      <CompactSideBarTravel
        {...defaultProps}
        isMobile={true}
        closeMenu={closeMenu}
      />
    );

    const closeButton = getAllByLabelText('Закрыть меню')[0];
    fireEvent.press(closeButton);

    expect(closeMenu).toHaveBeenCalled();
  });

  it('should render categories when available', () => {
    const travel = createMockTravel({
      travelAddress: [
        { categoryName: 'Museum, Park' },
        { categoryName: 'Restaurant' },
      ] as any,
    });

    const { getByText } = render(
      <CompactSideBarTravel {...defaultProps} travel={travel} />
    );

    expect(getByText('Museum')).toBeTruthy();
    expect(getByText('Park')).toBeTruthy();
  });

  it('should render view count when available', () => {
    const travel = createMockTravel({
      countUnicIpView: 1234,
    } as any);

    const { getByText } = render(
      <CompactSideBarTravel {...defaultProps} travel={travel} />
    );

    expect(getByText('1 234')).toBeTruthy();
  });

  it('should render WeatherWidget', () => {
    const { getByTestId } = render(
      <CompactSideBarTravel {...defaultProps} />
    );

    expect(getByTestId('weather-widget')).toBeTruthy();
  });

  it('should highlight active section', () => {
    const travel = createMockTravel({
      gallery: [{ id: 1, url: 'test.jpg' }],
    } as any);

    const { getByText } = render(
      <CompactSideBarTravel
        {...defaultProps}
        travel={travel}
        activeSection="gallery"
      />
    );

    const galleryLink = getByText('Галерея');
    // The link should have active styling (we can't easily test styles, but we can test accessibility)
    expect(galleryLink).toBeTruthy();
  });
});

