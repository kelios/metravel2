import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Simple test to verify our adaptive layout functions work
describe('Adaptive Layout Tests', () => {
  it('should calculate columns correctly', () => {
    // Test the calculateColumns function directly
    const { calculateColumns } = require('../components/listTravel/utils/listTravelHelpers');

    expect(calculateColumns(360)).toBe(1); // Mobile
    expect(calculateColumns(768)).toBe(2); // Tablet
    expect(calculateColumns(1024)).toBe(3); // Desktop
    expect(calculateColumns(1440)).toBe(3); // Large desktop (max 3)
    expect(calculateColumns(2560)).toBe(3); // XXL (max 3)
  });

  it('should render without errors', () => {
    render(<Text>Test component renders</Text>);
    expect(screen.getByText('Test component renders')).toBeTruthy();
  });
});
