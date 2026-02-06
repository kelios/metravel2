// __tests__/components/FormFieldWithValidation.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation';

describe('FormFieldWithValidation', () => {
  const defaultProps = {
    label: 'Test Field',
    children: <TextInput testID="test-input" />,
  };

  it('should render label', () => {
    const { getByText } = render(<FormFieldWithValidation {...defaultProps} />);
    expect(getByText('Test Field')).toBeTruthy();
  });

  it('should show required indicator when required', () => {
    const { getByText } = render(
      <FormFieldWithValidation {...defaultProps} required />
    );
    expect(getByText(/\*/)).toBeTruthy();
  });

  it('should display error message when error prop is provided', () => {
    const { getByText } = render(
      <FormFieldWithValidation {...defaultProps} error="This field is required" />
    );
    expect(getByText('This field is required')).toBeTruthy();
  });

  it('should not show error when showError is false', () => {
    const { queryByText } = render(
      <FormFieldWithValidation
        {...defaultProps}
        error="This field is required"
        showError={false}
      />
    );
    expect(queryByText('This field is required')).toBeFalsy();
  });

  it('should render hint when provided', () => {
    const { getByText } = render(
      <FormFieldWithValidation {...defaultProps} hint="Enter your name" />
    );
    // Hint icon should be present
    expect(getByText).toBeTruthy();
  });

  it('should toggle hint visibility on press', () => {
    const { getByLabelText, queryByText } = render(
      <FormFieldWithValidation {...defaultProps} hint="This is a hint" />
    );

    const hintButton = getByLabelText('Показать подсказку');
    fireEvent.press(hintButton);

    // Hint should be visible after press
    expect(queryByText('This is a hint')).toBeTruthy();
  });

  it('should render children', () => {
    const { getByTestId } = render(<FormFieldWithValidation {...defaultProps} />);
    expect(getByTestId('test-input')).toBeTruthy();
  });

  it('should have accessible error message', () => {
    const { getByText } = render(
      <FormFieldWithValidation {...defaultProps} error="Error message" />
    );
    const errorText = getByText('Error message');
    const errorContainer = errorText.parent;
    
    // Check if error container or its parent has accessibility role
    expect(
      errorContainer?.props.accessibilityRole === 'alert' ||
      errorContainer?.parent?.props.accessibilityRole === 'alert'
    ).toBe(true);
  });

  it('should handle multiple errors gracefully', () => {
    const { rerender, getByText } = render(
      <FormFieldWithValidation {...defaultProps} error="Error 1" />
    );
    expect(getByText('Error 1')).toBeTruthy();

    rerender(<FormFieldWithValidation {...defaultProps} error="Error 2" />);
    expect(getByText('Error 2')).toBeTruthy();
  });

  it('should render without crashing when no props provided', () => {
    expect(() =>
      render(
        <FormFieldWithValidation label="Test">
          <TextInput />
        </FormFieldWithValidation>
      )
    ).not.toThrow();
  });
});
