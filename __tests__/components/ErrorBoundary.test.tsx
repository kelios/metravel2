import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import LoaderScreenErrorBoundary from '@/components/ui/LoaderScreenErrorBoundary';

jest.mock('@/utils/logger', () => ({
  logError: jest.fn(),
}));

const mockReload = jest.fn();
let origLocation: Location;

beforeAll(() => {
  origLocation = (global as any).window?.location;
  // @ts-ignore -- delete non-optional property for test mock setup
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

  it('replaces the expo-router loader failure with a localized page message (#2822)', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <ThrowError message="Failed to load loader data for route: /(tabs)/quests/15/lida-castle" />
      </ErrorBoundary>
    );

    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('Не удалось загрузить страницу. Проверьте соединение и попробуйте ещё раз.');
    expect(tree).not.toContain('lida-castle');
    expect(tree).toContain('Попробовать снова');

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

  it('shows retry button on web and uses local reset instead of reload', () => {
    const consoleError = console.error;
    console.error = jest.fn();
    Platform.OS = 'web';

    const { getByLabelText } = render(
      <ErrorBoundary>
        <ThrowError message="ChunkLoadError: Loading chunk 42 failed." />
      </ErrorBoundary>
    );

    fireEvent.press(getByLabelText('Попробовать снова'));
    expect(mockReload).not.toHaveBeenCalled();

    console.error = consoleError;
  });

  it('renders retry button on native platforms', () => {
    const consoleError = console.error;
    console.error = jest.fn();
    Platform.OS = 'ios';

    const { getByLabelText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByLabelText('Попробовать снова')).toBeTruthy();
    console.error = consoleError;
  });
  it('keeps a failed loader inside the screen and retries it there (#2822)', () => {
    const retry = jest.fn(async () => undefined);
    const error = new Error('Failed to load loader data for route: /(tabs)/quests/15/lida-castle');

    const { getByLabelText, toJSON } = render(<LoaderScreenErrorBoundary error={error} retry={retry} />);

    expect(JSON.stringify(toJSON())).toContain('Не удалось загрузить страницу.');
    fireEvent.press(getByLabelText('Попробовать снова'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('passes every non-loader screen error up to the app boundary (#2822)', () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = render(
      <ErrorBoundary>
        <LoaderScreenErrorBoundary error={new Error('Map container is being reused by another instance')} retry={jest.fn()} />
      </ErrorBoundary>
    );

    expect(JSON.stringify(toJSON())).toContain('Map container is being reused by another instance');
    console.error = consoleError;
  });
});
