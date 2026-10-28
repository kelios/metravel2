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

  it('renders label correctly', async () => {
    const { getByText } = await render(
      <Chip label="Test Chip" onPress={() => {}} />
    );
    
    expect(getByText('Test Chip')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(
      <Chip label="Test Chip" onPress={onPress} />
    );
    
    const chip = getByRole('button');
    await fireEvent.press(chip);
    
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when not provided', async () => {
    const { getByRole } = await render(
      <Chip label="Test Chip" />
    );
    
    const chip = getByRole('button');
    await fireEvent.press(chip);
    
    // Should not throw error
    expect(chip).toBeTruthy();
  });

  it('displays count when provided', async () => {
    const { getByText } = await render(
      <Chip label="Test Chip" count={5} onPress={() => {}} />
    );
    
    expect(getByText('Test Chip')).toBeTruthy();
    expect(getByText('(5)')).toBeTruthy();
  });

  it('does not display count when not provided', async () => {
    const { queryByText } = await render(
      <Chip label="Test Chip" onPress={() => {}} />
    );
    
    expect(queryByText(/\(\d+\)/)).toBeNull();
  });

  it('renders icon when provided', async () => {
    const { View } = require('react-native');
    const { getByTestId } = await render(
      <Chip
        label="Test Chip"
        icon={<View testID="test-icon" />}
        onPress={() => {}}
      />
    );
    
    expect(getByTestId('test-icon')).toBeTruthy();
  });

  it('marks as selected when selected prop is true', async () => {
    const { getByRole } = await render(
      <Chip label="Test Chip" selected={true} onPress={() => {}} />
    );
    
    const chip = getByRole('button');
    expect(chip.props.accessibilityState.selected).toBe(true);
  });

  it('marks as not selected when selected prop is false', async () => {
    const { getByRole } = await render(
      <Chip label="Test Chip" selected={false} onPress={() => {}} />
    );
    
    const chip = getByRole('button');
    expect(chip.props.accessibilityState.selected).toBe(false);
  });

  it('has correct accessibility label', async () => {
    const { getByLabelText } = await render(
      <Chip label="Test Chip" onPress={() => {}} />
    );
    
    expect(getByLabelText('Test Chip')).toBeTruthy();
  });

  it('applies selected styles when selected', async () => {
    const { getByRole } = await render(
      <Chip label="Test Chip" selected={true} onPress={() => {}} />
    );
    
    const chip = getByRole('button');
    // Check that selected state is applied
    expect(chip.props.accessibilityState.selected).toBe(true);
  });

  it('handles large count numbers', async () => {
    const { getByText } = await render(
      <Chip label="Test Chip" count={9999} onPress={() => {}} />
    );
    
    expect(getByText('(9999)')).toBeTruthy();
  });

  it('handles zero count', async () => {
    const { getByText } = await render(
      <Chip label="Test Chip" count={0} onPress={() => {}} />
    );
    
    expect(getByText('(0)')).toBeTruthy();
  });

  it('truncates long labels correctly', async () => {
    const longLabel = 'A'.repeat(100);
    const { getByText } = await render(
      <Chip label={longLabel} onPress={() => {}} />
    );
    
    const label = getByText(longLabel);
    expect(label.props.numberOfLines).toBe(1);
  });

  it('handles testID prop', async () => {
    const { getByTestId } = await render(
      <Chip label="Test Chip" testID="custom-chip" onPress={() => {}} />
    );
    
    expect(getByTestId('custom-chip')).toBeTruthy();
  });

  // #2114: пока число грузится, слот счётчика занят невидимым «(0)» — чип не расширяется.
  it('countPending резервирует слот счётчика невидимым и скрытым от a11y', async () => {
    const { getByTestId } = await render(<Chip label="Организую" countPending testID="chip" />);
    const slot = getByTestId('chip-count-pending', { includeHiddenElements: true });
    expect(slot.props.children).toBe('(0)');
    expect(JSON.stringify(slot.props.style)).toMatch(/"opacity":0/);
    expect(slot.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('число важнее countPending', async () => {
    const { queryByTestId, getByText } = await render(<Chip label="Организую" count={3} countPending testID="chip" />);
    expect(queryByTestId('chip-count-pending', { includeHiddenElements: true })).toBeNull();
    expect(getByText('(3)')).toBeTruthy();
  });
});
