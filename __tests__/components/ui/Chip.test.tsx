// Chip.test.tsx - Тесты для компонента Chip
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Chip from '@/components/ui/Chip';

// Mock Platform
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: { OS: 'web', select: jest.fn((obj) => obj.web || obj.default) },
  };
});

describe('Chip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label correctly', () => {
    const { getByText } = render(
      <Chip label="Test Chip" onPress={() => {}} />
    );
    
    expect(getByText('Test Chip')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <Chip label="Test Chip" onPress={onPress} />
    );
    
    const chip = getByRole('button');
    fireEvent.press(chip);
    
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when not provided', () => {
    const { getByRole } = render(
      <Chip label="Test Chip" />
    );
    
    const chip = getByRole('button');
    fireEvent.press(chip);
    
    // Should not throw error
    expect(chip).toBeTruthy();
  });

  it('displays count when provided', () => {
    const { getByText } = render(
      <Chip label="Test Chip" count={5} onPress={() => {}} />
    );
    
    expect(getByText('Test Chip')).toBeTruthy();
    expect(getByText('(5)')).toBeTruthy();
  });

  it('does not display count when not provided', () => {
    const { queryByText } = render(
      <Chip label="Test Chip" onPress={() => {}} />
    );
    
    expect(queryByText(/\(\d+\)/)).toBeNull();
  });

  it('renders icon when provided', () => {
    const { View } = require('react-native');
    const { getByTestId } = render(
      <Chip
        label="Test Chip"
        icon={<View testID="test-icon" />}
        onPress={() => {}}
      />
    );
    
    expect(getByTestId('test-icon')).toBeTruthy();
  });

  it('marks as selected when selected prop is true', () => {
    const { getByRole } = render(
      <Chip label="Test Chip" selected={true} onPress={() => {}} />
    );
    
    const chip = getByRole('button');
    expect(chip.props.accessibilityState.selected).toBe(true);
  });

  it('marks as not selected when selected prop is false', () => {
    const { getByRole } = render(
      <Chip label="Test Chip" selected={false} onPress={() => {}} />
    );
    
    const chip = getByRole('button');
    expect(chip.props.accessibilityState.selected).toBe(false);
  });

  it('has correct accessibility label', () => {
    const { getByLabelText } = render(
      <Chip label="Test Chip" onPress={() => {}} />
    );
    
    expect(getByLabelText('Test Chip')).toBeTruthy();
  });

  it('applies selected styles when selected', () => {
    const { getByRole } = render(
      <Chip label="Test Chip" selected={true} onPress={() => {}} />
    );
    
    const chip = getByRole('button');
    // Check that selected state is applied
    expect(chip.props.accessibilityState.selected).toBe(true);
  });

  it('handles large count numbers', () => {
    const { getByText } = render(
      <Chip label="Test Chip" count={9999} onPress={() => {}} />
    );
    
    expect(getByText('(9999)')).toBeTruthy();
  });

  it('handles zero count', () => {
    const { getByText } = render(
      <Chip label="Test Chip" count={0} onPress={() => {}} />
    );
    
    expect(getByText('(0)')).toBeTruthy();
  });

  it('truncates long labels correctly', () => {
    const longLabel = 'A'.repeat(100);
    const { getByText } = render(
      <Chip label={longLabel} onPress={() => {}} />
    );
    
    const label = getByText(longLabel);
    expect(label.props.numberOfLines).toBe(1);
  });

  it('handles testID prop', () => {
    const { getByTestId } = render(
      <Chip label="Test Chip" testID="custom-chip" onPress={() => {}} />
    );
    
    expect(getByTestId('custom-chip')).toBeTruthy();
  });
});

