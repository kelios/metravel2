import React from 'react';
import { render } from '@testing-library/react-native';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { Text } from 'react-native';

// Mock logger
jest.mock('@/utils/logger', () => ({
  logError: jest.fn(),
}));

// Mock window for web platform
const mockWindow = {
  location: {
    reload: jest.fn(),
  },
};

beforeAll(() => {
  (global as any).window = mockWindow;
});

describe('ErrorBoundary', () => {
  // Компонент, который выбрасывает ошибку
  const ThrowError = ({ shouldThrow }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <Text>No error</Text>;
  };

  it('should render children when there is no error', () => {
    const { toJSON } = render(
      <ErrorBoundary>
        <Text>Test Content</Text>
      </ErrorBoundary>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test Content');
  });

  it('should render error UI when error occurs', () => {
    // Подавляем ошибку в консоли для теста
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    expect(tree).toBeTruthy();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Что-то пошло не так');

    console.error = consoleError;
  });

  it('should call onError callback when error occurs', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // onError вызывается в componentDidCatch
    expect(onError).toHaveBeenCalled();

    console.error = consoleError;
  });

  it('should render custom fallback when provided', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const customFallback = <Text>Custom Error</Text>;
    const { toJSON } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Custom Error');

    console.error = consoleError;
  });

  it('should show error message in error UI', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Test error');

    console.error = consoleError;
  });

  it('should have reset button', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tree = toJSON();
    const treeStr = JSON.stringify(tree);
    expect(treeStr).toContain('Попробовать снова');

    console.error = consoleError;
  });
});

