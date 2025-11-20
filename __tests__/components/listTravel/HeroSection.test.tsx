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
  Feather: ({ name, size, color, ...props }: any) => {
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

  it('renders with default props', () => {
    const { getByText } = render(<HeroSection />);
    
    expect(getByText('Откройте мир путешествий')).toBeTruthy();
    expect(getByText('Авторские маршруты и идеи для вашего приключения')).toBeTruthy();
  });

  it('renders custom title and subtitle', () => {
    const { getByText } = render(
      <HeroSection
        title="Custom Title"
        subtitle="Custom Subtitle"
      />
    );
    
    expect(getByText('Custom Title')).toBeTruthy();
    expect(getByText('Custom Subtitle')).toBeTruthy();
  });

  it('renders default stats', () => {
    const { getByText } = render(<HeroSection />);
    
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
    
    const { getByText } = render(<HeroSection stats={customStats} />);
    
    expect(getByText('100+')).toBeTruthy();
    expect(getByText('20+')).toBeTruthy();
  });

  it('renders search button when onSearchPress is provided', () => {
    const onSearchPress = jest.fn();
    const { getByLabelText, getByText } = render(
      <HeroSection onSearchPress={onSearchPress} />
    );
    
    const searchButton = getByLabelText('Поиск путешествий');
    expect(searchButton).toBeTruthy();
    expect(getByText('Например: Париж, горнолыжный курорт, море')).toBeTruthy();
    
    fireEvent.press(searchButton);
    expect(onSearchPress).toHaveBeenCalledTimes(1);
  });

  it('does not render search button when onSearchPress is not provided', () => {
    const { queryByLabelText } = render(<HeroSection />);
    
    expect(queryByLabelText('Поиск путешествий')).toBeNull();
  });

  it('renders custom search placeholder', () => {
    const { getByText } = render(
      <HeroSection
        onSearchPress={() => {}}
        searchPlaceholder="Custom placeholder"
      />
    );
    
    expect(getByText('Custom placeholder')).toBeTruthy();
  });

  it('renders popular categories', () => {
    const popularCategories = [
      { id: 1, name: 'Горы', icon: 'mountain' },
      { id: 2, name: 'Пляжи', icon: 'sun' },
      { id: 3, name: 'Города', icon: 'map-pin' },
      { id: 4, name: 'Природа', icon: 'tree' },
    ];
    
    const onCategoryPress = jest.fn();
    const { getByText } = render(
      <HeroSection
        popularCategories={popularCategories}
        onCategoryPress={onCategoryPress}
      />
    );
    
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
    const { getByText } = render(
      <HeroSection
        popularCategories={popularCategories}
        onCategoryPress={onCategoryPress}
      />
    );
    
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
    
    const { getByText, queryByText } = render(
      <HeroSection popularCategories={popularCategories} />
    );
    
    expect(getByText('Горы')).toBeTruthy();
    expect(getByText('Пляжи')).toBeTruthy();
    expect(getByText('Города')).toBeTruthy();
    expect(getByText('Природа')).toBeTruthy();
    expect(queryByText('Музеи')).toBeNull();
  });

  it('renders stats icons', () => {
    const { getByTestId } = render(<HeroSection />);
    
    expect(getByTestId('feather-map-pin')).toBeTruthy();
    expect(getByTestId('feather-globe')).toBeTruthy();
    expect(getByTestId('feather-users')).toBeTruthy();
  });

  it('does not render popular categories section when empty', () => {
    const { queryByText } = render(<HeroSection popularCategories={[]} />);
    
    expect(queryByText('Популярные категории:')).toBeNull();
  });

  it('handles mobile layout correctly', () => {
    const RN = require('react-native');
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667 });
    
    const { getByText } = render(<HeroSection />);
    
    // Компонент должен рендериться с мобильными стилями
    expect(getByText('Откройте мир путешествий')).toBeTruthy();
    
    RN.useWindowDimensions.mockRestore();
  });

  it('has correct accessibility roles', () => {
    const { getByRole, getByLabelText } = render(
      <HeroSection onSearchPress={() => {}} />
    );
    
    expect(getByRole('header')).toBeTruthy();
    expect(getByLabelText('Поиск путешествий')).toBeTruthy();
  });
});

