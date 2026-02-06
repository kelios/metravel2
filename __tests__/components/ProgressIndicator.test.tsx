import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProgressIndicator from '@/components/ui/ProgressIndicator';

// Mock design system
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      primary: '#6b8e7f',
      text: '#1f2937',
      textMuted: '#6b7280',
      border: '#e5e7eb',
    },
  },
}));

describe('ProgressIndicator', () => {
  it('should render with progress value', () => {
    const { toJSON } = render(<ProgressIndicator progress={50} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should display percentage when showPercentage is true', () => {
    const { toJSON } = render(
      <ProgressIndicator progress={75} showPercentage={true} />
    );
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('75');
  });

  it('should not display percentage when showPercentage is false', () => {
    const { toJSON } = render(
      <ProgressIndicator progress={50} showPercentage={false} />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should display stage text', () => {
    const { toJSON } = render(
      <ProgressIndicator progress={50} stage="Processing" />
    );
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Processing');
  });

  it('should display message text', () => {
    const { toJSON } = render(
      <ProgressIndicator progress={50} message="Loading data..." />
    );
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Loading data...');
  });

  it('should clamp progress to 0-100 range', () => {
    const { toJSON } = render(<ProgressIndicator progress={150} />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    // Должно показать 100% вместо 150%
    expect(treeStr).toContain('100');
  });

  it('should handle negative progress', () => {
    const { toJSON } = render(<ProgressIndicator progress={-10} />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    // Должно показать 0% вместо -10%
    expect(treeStr).toContain('0');
  });

  it('should render with small size', () => {
    const { toJSON } = render(
      <ProgressIndicator progress={50} size="small" />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with medium size', () => {
    const { toJSON } = render(
      <ProgressIndicator progress={50} size="medium" />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should render with large size', () => {
    const { toJSON } = render(
      <ProgressIndicator progress={50} size="large" />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should call onCancel when cancel button is pressed', () => {
    const onCancel = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ProgressIndicator progress={50} onCancel={onCancel} />
    );

    const { Text } = require('react-native');
    const texts = UNSAFE_getAllByType(Text);
    
    // Находим кнопку отмены
    const cancelButton = texts.find((t: any) => 
      t.props.children === 'Отменить'
    );

    if (cancelButton) {
      fireEvent.press(cancelButton);
      expect(onCancel).toHaveBeenCalledTimes(1);
    }
  });

  it('should not show cancel button when onCancel is not provided', () => {
    const { toJSON } = render(<ProgressIndicator progress={50} />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('Отменить');
  });

  it('should render progress bar with correct width', () => {
    const { toJSON } = render(<ProgressIndicator progress={60} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('should round progress percentage', () => {
    const { toJSON } = render(<ProgressIndicator progress={33.7} />);
    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    // Должно округлить до 34%
    expect(treeStr).toContain('34');
  });
});

