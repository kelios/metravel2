// CategoryChips.test.tsx - Тесты для компонента CategoryChips
import { render, fireEvent } from '@testing-library/react-native';
import CategoryChips from '@/components/CategoryChips';

// Mock Chip component
jest.mock('@/components/ui/Chip', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return React.forwardRef(({ label, selected, count, icon, onPress, ...props }: any, ref: any) => (
    <Pressable
      ref={ref}
      onPress={onPress}
      testID={`chip-${label}`}
      accessibilityState={{ selected }}
      {...props}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon && <View testID={`chip-icon-${label}`}>{icon}</View>}
        <Text>{label}</Text>
        {count !== undefined && <Text testID={`chip-count-${label}`}>({count})</Text>}
      </View>
    </Pressable>
  ));
});

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, size: _size, color: _color, ...props }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={`feather-${name}`} {...props}>
        <Text>{name}</Text>
      </View>
    );
  },
}));

// Mock Platform
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
  };
});

describe('CategoryChips', () => {
  const mockCategories = [
    { id: 1, name: 'Горы', count: 10 },
    { id: 2, name: 'Пляжи', count: 5 },
    { id: 3, name: 'Города', count: 8 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when categories is empty', () => {
    const { toJSON } = render(
      <CategoryChips
        categories={[]}
        selectedCategories={[]}
        onToggleCategory={() => {}}
      />
    );
    
    expect(toJSON()).toBeNull();
  });

  it('renders categories correctly', () => {
    const { getByTestId } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={[]}
        onToggleCategory={() => {}}
      />
    );
    
    expect(getByTestId('chip-Горы')).toBeTruthy();
    expect(getByTestId('chip-Пляжи')).toBeTruthy();
    expect(getByTestId('chip-Города')).toBeTruthy();
  });

  it('displays category counts', () => {
    const { getByTestId } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={[]}
        onToggleCategory={() => {}}
      />
    );
    
    expect(getByTestId('chip-count-Горы')).toBeTruthy();
    expect(getByTestId('chip-count-Пляжи')).toBeTruthy();
  });

  it('calls onToggleCategory when category is pressed', () => {
    const onToggleCategory = jest.fn();
    const { getByTestId } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={[]}
        onToggleCategory={onToggleCategory}
      />
    );
    
    fireEvent.press(getByTestId('chip-Горы'));
    
    expect(onToggleCategory).toHaveBeenCalledWith('Горы');
    expect(onToggleCategory).toHaveBeenCalledTimes(1);
  });

  it('marks selected categories as selected', () => {
    const { getByTestId } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={['Горы', 'Пляжи']}
        onToggleCategory={() => {}}
      />
    );
    
    const mountainsChip = getByTestId('chip-Горы');
    expect(mountainsChip.props.accessibilityState.selected).toBe(true);
    
    const beachesChip = getByTestId('chip-Пляжи');
    expect(beachesChip.props.accessibilityState.selected).toBe(true);
    
    const citiesChip = getByTestId('chip-Города');
    expect(citiesChip.props.accessibilityState.selected).toBe(false);
  });

  it('shows icons for popular categories when showIcons is true', () => {
    const { getByTestId } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        showIcons={true}
      />
    );
    
    // Горы should have mountain icon
    expect(getByTestId('chip-icon-Горы')).toBeTruthy();
    expect(getByTestId('feather-mountain')).toBeTruthy();
    
    // Пляжи should have sun icon
    expect(getByTestId('chip-icon-Пляжи')).toBeTruthy();
    expect(getByTestId('feather-sun')).toBeTruthy();
    
    // Города should have map-pin icon
    expect(getByTestId('chip-icon-Города')).toBeTruthy();
    expect(getByTestId('feather-map-pin')).toBeTruthy();
  });

  it('does not show icons when showIcons is false', () => {
    const { queryByTestId } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        showIcons={false}
      />
    );
    
    expect(queryByTestId('chip-icon-Горы')).toBeNull();
  });

  it('shows X icon for selected categories instead of category icon', () => {
    const { getByTestId, queryByTestId } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={['Горы']}
        onToggleCategory={() => {}}
        showIcons={true}
      />
    );
    
    // Should show X icon instead of mountain icon
    expect(getByTestId('chip-icon-Горы')).toBeTruthy();
    expect(queryByTestId('feather-mountain')).toBeNull();
    expect(getByTestId('feather-x')).toBeTruthy();
  });

  it('uses custom icon from category if provided', () => {
    const categoriesWithCustomIcon = [
      { id: 1, name: 'Кастомная', icon: 'star', count: 5 },
    ];
    
    const { getByTestId } = render(
      <CategoryChips
        categories={categoriesWithCustomIcon}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        showIcons={true}
      />
    );
    
    expect(getByTestId('feather-star')).toBeTruthy();
  });

  it('limits visible categories to maxVisible', () => {
    const manyCategories = [
      { id: 1, name: 'Категория 1' },
      { id: 2, name: 'Категория 2' },
      { id: 3, name: 'Категория 3' },
      { id: 4, name: 'Категория 4' },
      { id: 5, name: 'Категория 5' },
    ];
    
    const { getByTestId, queryByTestId, getByText } = render(
      <CategoryChips
        categories={manyCategories}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        maxVisible={3}
      />
    );
    
    expect(getByTestId('chip-Категория 1')).toBeTruthy();
    expect(getByTestId('chip-Категория 2')).toBeTruthy();
    expect(getByTestId('chip-Категория 3')).toBeTruthy();
    expect(queryByTestId('chip-Категория 4')).toBeNull();
    expect(queryByTestId('chip-Категория 5')).toBeNull();
    
    // Should show "+2" indicator
    expect(getByText('+2')).toBeTruthy();
  });

  it('shows correct count in more indicator', () => {
    const manyCategories = [
      { id: 1, name: 'Категория 1' },
      { id: 2, name: 'Категория 2' },
      { id: 3, name: 'Категория 3' },
      { id: 4, name: 'Категория 4' },
    ];
    
    const { getByText } = render(
      <CategoryChips
        categories={manyCategories}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        maxVisible={2}
      />
    );
    
    expect(getByText('+2')).toBeTruthy();
  });

  it('does not show more indicator when all categories are visible', () => {
    const { queryByText } = render(
      <CategoryChips
        categories={mockCategories}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        maxVisible={10}
      />
    );
    
    expect(queryByText(/^\+\d+$/)).toBeNull();
  });

  it('handles categories without count', () => {
    const categoriesWithoutCount = [
      { id: 1, name: 'Горы' },
      { id: 2, name: 'Пляжи', count: 5 },
    ];
    
    const { getByTestId, queryByTestId } = render(
      <CategoryChips
        categories={categoriesWithoutCount}
        selectedCategories={[]}
        onToggleCategory={() => {}}
      />
    );
    
    expect(getByTestId('chip-Горы')).toBeTruthy();
    expect(queryByTestId('chip-count-Горы')).toBeNull();
    
    expect(getByTestId('chip-Пляжи')).toBeTruthy();
    expect(getByTestId('chip-count-Пляжи')).toBeTruthy();
  });

  it('maps category names to icons correctly', () => {
    const categoryIconMap = [
      { id: 1, name: 'Горы' },
      { id: 2, name: 'Пляжи' },
      { id: 3, name: 'Города' },
      { id: 4, name: 'Природа' },
      { id: 5, name: 'Музеи' },
      { id: 6, name: 'Озера' },
      { id: 7, name: 'Культура' },
      { id: 8, name: 'Спорт' },
      { id: 9, name: 'Еда' },
      { id: 10, name: 'Архитектура' },
    ];
    
    const { getByTestId } = render(
      <CategoryChips
        categories={categoryIconMap}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        showIcons={true}
      />
    );
    
    expect(getByTestId('feather-mountain')).toBeTruthy(); // Горы
    expect(getByTestId('feather-sun')).toBeTruthy(); // Пляжи
    expect(getByTestId('feather-map-pin')).toBeTruthy(); // Города
    expect(getByTestId('feather-tree')).toBeTruthy(); // Природа
    expect(getByTestId('feather-building')).toBeTruthy(); // Музеи
    expect(getByTestId('feather-droplet')).toBeTruthy(); // Озера
    expect(getByTestId('feather-music')).toBeTruthy(); // Культура
    expect(getByTestId('feather-activity')).toBeTruthy(); // Спорт
    expect(getByTestId('feather-coffee')).toBeTruthy(); // Еда
    expect(getByTestId('feather-layers')).toBeTruthy(); // Архитектура
  });

  it('handles categories without icon mapping', () => {
    const unknownCategory = [
      { id: 1, name: 'Неизвестная категория' },
    ];
    
    const { getByTestId, queryByTestId } = render(
      <CategoryChips
        categories={unknownCategory}
        selectedCategories={[]}
        onToggleCategory={() => {}}
        showIcons={true}
      />
    );
    
    expect(getByTestId('chip-Неизвестная категория')).toBeTruthy();
    expect(queryByTestId('chip-icon-Неизвестная категория')).toBeNull();
  });
});
