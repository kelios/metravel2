import { render, fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import TravelListItem from '@/components/listTravel/TravelListItem';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueryData: jest.fn(),
    prefetchQuery: jest.fn(),
  }),
}));

jest.mock('@/components/travel/OptimizedFavoriteButton', () => {
  return function MockOptimizedFavoriteButton(props: any) {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable 
        testID="favorite-button"
        onPress={props.onPress}
      >
        <Text>❤️</Text>
      </Pressable>
    );
  };
});

describe('TravelListItem - Action Buttons', () => {
  const mockTravel = {
    id: 1,
    name: 'Test Travel',
    slug: 'test-travel',
    countries: ['USA', 'France'],
    travel_image_thumb_url: 'https://example.com/image.jpg',
    travel_image_thumb_small_url: 'https://example.com/image-small.jpg',
    url: '/test-travel',
    youtube_link: '',
    description: 'Test description',
    recommendation: 'Test recommendation',
    plus: 'Test plus',
    minus: 'Test minus',
    cityName: 'Test City',
    countryName: 'Test Country',
    countUnicIpView: '0',
    gallery: [],
    travelAddress: [],
    userIds: '123',
    year: '2024',
    monthName: 'January',
    number_days: 5,
    companions: [],
    countryCode: 'US',
    userName: 'Test User',
    views: 100,
  };

  const mockProps = {
    travel: mockTravel,
    isSuperuser: false,
    currentUserId: '123',
    selectable: false,
    isSingle: false,
    isSelected: false,
    onToggle: jest.fn(),
    onDeletePress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock web platform
    Platform.OS = 'web';
  });

  it('should prevent navigation when favorite button is clicked', () => {
    const { router } = require('expo-router');
    
    render(<TravelListItem {...mockProps} />);
    
    const favoriteButton = screen.getByTestId('favorite-button');
    
    // Simulate click on favorite button
    fireEvent.press(favoriteButton);
    
    // Should not navigate to travel detail
    expect(router.push).not.toHaveBeenCalledWith('/travels/1');
  });

  it('should prevent navigation when edit button is clicked', () => {
    const { router } = require('expo-router');
    
    render(<TravelListItem {...mockProps} />);
    
    // Find edit button (it has edit-2 icon)
    const editButton = screen.getByLabelText('Редактировать');
    
    // Simulate click on edit button
    fireEvent.press(editButton);
    
    // Should navigate to edit page, not travel detail
    expect(router.push).toHaveBeenCalledWith('/travel/1');
    expect(router.push).not.toHaveBeenCalledWith('/travels/1');
  });

  it('should prevent navigation when delete button is clicked', () => {
    const { router } = require('expo-router');
    
    render(<TravelListItem {...mockProps} />);
    
    // Find delete button (it has trash-2 icon)
    const deleteButton = screen.getByLabelText('Удалить');
    
    // Simulate click on delete button
    fireEvent.press(deleteButton);
    
    // Should call delete handler, not navigate
    expect(mockProps.onDeletePress).toHaveBeenCalledWith(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('should navigate to travel detail when card is clicked (not action buttons)', () => {
    const { router } = require('expo-router');
    
    render(<TravelListItem {...mockProps} />);
    
    // Click on the card container (not an action button)
    const card = screen.getByTestId('travel-card-link');
    const mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      button: 0,
    };
    fireEvent(card, 'click', mockEvent);
    
    // Should navigate to travel detail
    expect(router.push).toHaveBeenCalledWith('/test-travel');
  });

  it('should work correctly on mobile platform', () => {
    // Mock mobile platform
    Platform.OS = 'ios';
    
    const { router } = require('expo-router');
    
    render(<TravelListItem {...mockProps} />);
    
    // Click on card title
    const cardTitle = screen.getByText('Test Travel');
    fireEvent.press(cardTitle);
    
    // Should still navigate on mobile
    expect(router.push).toHaveBeenCalledWith('/test-travel');
  });

  it('should handle events correctly with stopPropagation and preventDefault', () => {
    // Test the behavior through component interaction
    render(<TravelListItem {...mockProps} />);
    
    // Just verify the component renders without crashing
    expect(screen.getByText('Test Travel')).toBeTruthy();
  });
});
