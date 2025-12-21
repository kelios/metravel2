// HeroSection.test.tsx - Тесты для компонента HeroSection
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HeroSection from '@/components/listTravel/HeroSection';

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
    Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
  };
});

// Mock LinearGradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, ...props }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={`feather-${name}`} {...props}>
        <Text>{name}</Text>
      </View>
    );
  },
}));

describe('HeroSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const expand = (utils: ReturnType<typeof render>) => {
    const toggle = utils.getByText('О нас');
    fireEvent.press(toggle);
  };

  it('renders with default props', () => {
    const utils = render(<HeroSection />);
    expand(utils);
    const { getByText } = utils;

    expect(getByText('Откройте мир путешествий')).toBeTruthy();
    expect(getByText('Авторские маршруты и идеи для вашего приключения')).toBeTruthy();
  });

  it('renders custom title and subtitle', () => {
    const utils = render(
      <HeroSection
        title="Custom Title"
        subtitle="Custom Subtitle"
      />
    );
    expand(utils);
    const { getByText } = utils;

    expect(getByText('Custom Title')).toBeTruthy();
    expect(getByText('Custom Subtitle')).toBeTruthy();
  });

  it('renders default stats', () => {
    const utils = render(<HeroSection />);
    expand(utils);
    const { getByText } = utils;

    expect(getByText('500+')).toBeTruthy();
    expect(getByText('маршрутов')).toBeTruthy();
    expect(getByText('50+')).toBeTruthy();
    expect(getByText('стран')).toBeTruthy();
    expect(getByText('10k+')).toBeTruthy();
    expect(getByText('путешественников')).toBeTruthy();
  });

  it('renders custom stats', () => {
    const customStats = [
      { icon: 'map-pin', value: '100+', label: 'маршрутов' },
      { icon: 'globe', value: '20+', label: 'стран' },
    ];
    const utils = render(<HeroSection stats={customStats} />);
    expand(utils);
    const { getByText } = utils;

    expect(getByText('100+')).toBeTruthy();
    expect(getByText('20+')).toBeTruthy();
  });

  it('renders popular categories', () => {
    const popularCategories = [
      { id: 1, name: 'Горы', icon: 'mountain' },
      { id: 2, name: 'Пляжи', icon: 'sun' },
      { id: 3, name: 'Города', icon: 'map-pin' },
      { id: 4, name: 'Природа', icon: 'tree' },
    ];
    const onCategoryPress = jest.fn();
    const utils = render(
      <HeroSection
        popularCategories={popularCategories}
        onCategoryPress={onCategoryPress}
      />
    );
    expand(utils);
    const { getByText } = utils;

    expect(getByText('Популярные категории:')).toBeTruthy();
    expect(getByText('Горы')).toBeTruthy();
    expect(getByText('Пляжи')).toBeTruthy();
    expect(getByText('Города')).toBeTruthy();
    expect(getByText('Природа')).toBeTruthy();
  });

  it('calls onCategoryPress when category is pressed', () => {
    const popularCategories = [
      { id: 1, name: 'Горы', icon: 'mountain' },
    ];
    const onCategoryPress = jest.fn();
    const utils = render(
      <HeroSection
        popularCategories={popularCategories}
        onCategoryPress={onCategoryPress}
      />
    );
    expand(utils);
    const { getByText } = utils;

    const category = getByText('Горы');
    fireEvent.press(category);
    
    expect(onCategoryPress).toHaveBeenCalledWith(1);
  });

  it('limits popular categories to 4 items', () => {
    const popularCategories = [
      { id: 1, name: 'Горы', icon: 'mountain' },
      { id: 2, name: 'Пляжи', icon: 'sun' },
      { id: 3, name: 'Города', icon: 'map-pin' },
      { id: 4, name: 'Природа', icon: 'tree' },
      { id: 5, name: 'Музеи', icon: 'building' },
    ];
    const utils = render(
      <HeroSection popularCategories={popularCategories} />
    );
    expand(utils);
    const { getByText, queryByText } = utils;

    expect(getByText('Горы')).toBeTruthy();
    expect(getByText('Пляжи')).toBeTruthy();
    expect(getByText('Города')).toBeTruthy();
    expect(getByText('Природа')).toBeTruthy();
    expect(queryByText('Музеи')).toBeNull();
  });

  it('renders stats icons', () => {
    const utils = render(<HeroSection />);
    expand(utils);
    const { getByTestId } = utils;

    expect(getByTestId('feather-map-pin')).toBeTruthy();
    expect(getByTestId('feather-globe')).toBeTruthy();
    expect(getByTestId('feather-users')).toBeTruthy();
  });

  it('does not render popular categories section when empty', () => {
    const utils = render(<HeroSection popularCategories={[]} />);
    expand(utils);
    const { queryByText } = utils;

    expect(queryByText('Популярные категории:')).toBeNull();
  });

  it('handles mobile layout correctly', () => {
    const RN = require('react-native');
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667 });
    
    const utils = render(<HeroSection />);
    expand(utils);
    const { getByText } = utils;
    expect(getByText('Откройте мир путешествий')).toBeTruthy();
    
    RN.useWindowDimensions.mockRestore();
  });

  it('has correct accessibility roles on expanded title', () => {
    const utils = render(<HeroSection />);
    expand(utils);
    const { getByRole } = utils;
    expect(getByRole('header')).toBeTruthy();
  });

  it('toggles expanded state via button', () => {
    const { getByText, queryByText } = render(<HeroSection />);
    const toggle = getByText('О нас');
    expect(queryByText('Откройте мир путешествий')).toBeNull();
    fireEvent.press(toggle);
    expect(getByText('Свернуть')).toBeTruthy();
    expect(getByText('Откройте мир путешествий')).toBeTruthy();
    fireEvent.press(getByText('Свернуть'));
    expect(queryByText('Откройте мир путешествий')).toBeNull();
  });
});
