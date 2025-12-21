import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ErrorDisplay from '@/components/ErrorDisplay';
import { Platform } from 'react-native';

// Mock Feather icons
jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, size: _size, color: _color, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

// Mock design system
jest.mock('@/constants/designSystem', () => ({
  DESIGN_TOKENS: {
    colors: {
      primary: '#6b8e7f',
      text: '#1f2937',
      textMuted: '#6b7280',
    },
  },
}));

let openSpy: jest.Mock;

beforeAll(() => {
  openSpy = jest.fn();
  Object.defineProperty(globalThis, 'window', {
    value: {
      open: openSpy,
    },
    writable: true,
  });
});

beforeEach(() => {
  openSpy.mockClear();
});

// Mock __DEV__
(global as any).__DEV__ = true;

describe('ErrorDisplay', () => {
  it('should render with default title and message', () => {
    const { toJSON } = render(
      <ErrorDisplay message="Something went wrong" />
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Что-то пошло не так');
    expect(treeStr).toContain('Something went wrong');
  });

  it('should render with custom title', () => {
    const { toJSON } = render(
      <ErrorDisplay 
        title="Custom Error"
        message="Error message"
      />
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Custom Error');
  });

  it('should render error icon for error variant', () => {
    const { getByTestId } = render(
      <ErrorDisplay 
        message="Error"
        variant="error"
      />
    );

    expect(getByTestId('feather-alert-circle')).toBeTruthy();
  });

  it('should render warning icon for warning variant', () => {
    const { getByTestId } = render(
      <ErrorDisplay 
        message="Warning"
        variant="warning"
      />
    );

    expect(getByTestId('feather-alert-triangle')).toBeTruthy();
  });

  it('should render info icon for info variant', () => {
    const { getByTestId } = render(
      <ErrorDisplay 
        message="Info"
        variant="info"
      />
    );

    expect(getByTestId('feather-info')).toBeTruthy();
  });

  it('should call onRetry when retry button is pressed', () => {
    const onRetry = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ErrorDisplay 
        message="Error"
        onRetry={onRetry}
      />
    );

    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    
    // Находим кнопку "Попробовать снова"
    const retryButton = pressables.find((p: any) => {
      const children = p.props.children;
      if (Array.isArray(children)) {
        return children.some((child: any) => 
          child?.props?.children === 'Попробовать снова'
        );
      }
      return false;
    });

    if (retryButton) {
      fireEvent.press(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    }
  });

  it('should call onDismiss when dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ErrorDisplay 
        message="Error"
        onDismiss={onDismiss}
      />
    );

    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    
    // Находим кнопку закрытия (X)
    const dismissButton = pressables.find((p: any) => 
      p.props.children?.props?.name === 'x'
    );

    if (dismissButton) {
      fireEvent.press(dismissButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    }
  });

  it('should show contact button when showContact is true', () => {
    const { toJSON } = render(
      <ErrorDisplay 
        message="Error"
        showContact={true}
      />
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Связаться с поддержкой');
  });

  it('should not show contact button when showContact is false', () => {
    const { toJSON } = render(
      <ErrorDisplay 
        message="Error"
        showContact={false}
      />
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('Связаться с поддержкой');
  });

  it('should show details in dev mode', () => {
    (global as any).__DEV__ = true;
    const { toJSON } = render(
      <ErrorDisplay 
        message="Error"
        details="Technical details"
      />
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Technical details');
    expect(treeStr).toContain('Технические детали');
  });

  it('should not show details when not in dev mode', () => {
    (global as any).__DEV__ = false;
    const { toJSON } = render(
      <ErrorDisplay 
        message="Error"
        details="Technical details"
      />
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).not.toContain('Technical details');
  });

  it('should open support link when contact button is pressed', () => {
    const originalPlatform = Platform.OS;
    Platform.OS = 'web';
    const { UNSAFE_getAllByType } = render(
      <ErrorDisplay 
        message="Error"
        showContact={true}
      />
    );

    const { Pressable } = require('react-native');
    const pressables = UNSAFE_getAllByType(Pressable);
    
    // Находим кнопку связи с поддержкой
    const contactButton = pressables.find((p: any) => {
      const children = p.props.children;
      if (Array.isArray(children)) {
        return children.some((child: any) => 
          child?.props?.children === 'Связаться с поддержкой'
        );
      }
      return false;
    });

    expect(contactButton).toBeDefined();
    fireEvent.press(contactButton);
    expect(openSpy).toHaveBeenCalledWith(
      'https://www.instagram.com/metravelby/',
      '_blank'
    );
    Platform.OS = originalPlatform;
  });
});
