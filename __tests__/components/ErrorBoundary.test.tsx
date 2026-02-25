import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

jest.mock('@/utils/logger', () => ({
  logError: jest.fn(),
}));

const mockReload = jest.fn();
let origLocation: Location;

beforeAll(() => {
  origLocation = (global as any).window?.location;
  // @ts-ignore
  delete ((global as any).window as any).location;
  (global as any).window.location = { ...origLocation, reload: mockReload };
});

afterAll(() => {
  if ((global as any).window) {
    (global as any).window.location = origLocation;
  }
});

describe('ErrorBoundary', () => {
  const { Platform } = require('react-native');
  let originalPlatform: string;

  const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
    throw new Error(message);
  };

  beforeEach(() => {
    originalPlatform = Platform.OS;
    mockReload.mockReset();
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('renders children when no error occurs', () => {
    const { toJSON } = render(
      <ErrorBoundary>
        <Text>OK</Text>
      </ErrorBoundary>
    );

    expect(JSON.stringify(toJSON())).toContain('OK');
  });

  it('renders generic error UI when child throws', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('Что-то пошло не так');
    expect(tree).toContain('Test error');
    expect(tree).toContain('Попробовать снова');
    expect(tree).not.toContain('Обновление приложения');
    expect(tree).not.toContain('Перезагрузить и очистить кеш');

    console.error = consoleError;
  });

  it('calls onError callback', () => {
    const consoleError = console.error;
    console.error = jest.fn();
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    console.error = consoleError;
  });

  it('renders custom fallback if provided', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary fallback={<Text>Custom fallback</Text>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(JSON.stringify(toJSON())).toContain('Custom fallback');
    console.error = consoleError;
  });

  it('shows reload button on web and triggers location.reload', () => {
    const consoleError = console.error;
    console.error = jest.fn();
    Platform.OS = 'web';

    const { getByLabelText } = render(
      <ErrorBoundary>
        <ThrowError message="ChunkLoadError: Loading chunk 42 failed." />
      </ErrorBoundary>
    );

    fireEvent.press(getByLabelText('Перезагрузить страницу'));
    expect(mockReload).toHaveBeenCalledTimes(1);

    console.error = consoleError;
  });

  it('hides reload button on native platforms', () => {
    const consoleError = console.error;
    console.error = jest.fn();
    Platform.OS = 'ios';

    const { queryByLabelText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(queryByLabelText('Перезагрузить страницу')).toBeNull();
    console.error = consoleError;
  });
});
