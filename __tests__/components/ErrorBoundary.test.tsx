import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import LoaderScreenErrorBoundary from '@/components/ui/LoaderScreenErrorBoundary';

jest.mock('@/utils/logger', () => ({
  logError: jest.fn(),
}));

// jsdom 26: window.location / location.reload — non-configurable, подменить нельзя (#2735).
// Перезагрузку ловим по сигналу jsdom «Not implemented: navigation», который jest-environment-jsdom
// отправляет в console.error.
const isNavigationAttempt = (call: unknown[]) =>
  call.some((arg) => String((arg as Error | undefined)?.message ?? arg).includes('Not implemented: navigation'));

describe('ErrorBoundary', () => {
  const { Platform } = require('react-native');
  let originalPlatform: string;

  const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
    throw new Error(message);
  };

  beforeEach(() => {
    originalPlatform = Platform.OS;
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('renders children when no error occurs', async () => {
    const { toJSON } = await render(
      <ErrorBoundary>
        <Text>OK</Text>
      </ErrorBoundary>
    );

    expect(JSON.stringify(toJSON())).toContain('OK');
  });

  it('renders generic error UI when child throws', async () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = await render(
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

  it('replaces the expo-router loader failure with a localized page message (#2822)', async () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = await render(
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

  it('calls onError callback', async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    const onError = jest.fn();

    await render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    console.error = consoleError;
  });

  it('renders custom fallback if provided', async () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = await render(
      <ErrorBoundary fallback={<Text>Custom fallback</Text>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(JSON.stringify(toJSON())).toContain('Custom fallback');
    console.error = consoleError;
  });

  it('shows retry button on web and uses local reset instead of reload', async () => {
    const consoleError = console.error;
    const errorSpy = jest.fn();
    console.error = errorSpy;
    Platform.OS = 'web';

    const { getByLabelText } = await render(
      <ErrorBoundary>
        <ThrowError message="ChunkLoadError: Loading chunk 42 failed." />
      </ErrorBoundary>
    );

    await fireEvent.press(getByLabelText('Попробовать снова'));
    expect(errorSpy.mock.calls.some(isNavigationAttempt)).toBe(false);

    console.error = consoleError;
  });

  it('renders retry button on native platforms', async () => {
    const consoleError = console.error;
    console.error = jest.fn();
    Platform.OS = 'ios';

    const { getByLabelText } = await render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByLabelText('Попробовать снова')).toBeTruthy();
    console.error = consoleError;
  });
  it('keeps a failed loader inside the screen and retries it there (#2822)', async () => {
    const retry = jest.fn(async () => undefined);
    const error = new Error('Failed to load loader data for route: /(tabs)/quests/15/lida-castle');

    const { getByLabelText, toJSON } = await render(<LoaderScreenErrorBoundary error={error} retry={retry} />);

    expect(JSON.stringify(toJSON())).toContain('Не удалось загрузить страницу.');
    await fireEvent.press(getByLabelText('Попробовать снова'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('passes every non-loader screen error up to the app boundary (#2822)', async () => {
    const consoleError = console.error;
    console.error = jest.fn();

    const { toJSON } = await render(
      <ErrorBoundary>
        <LoaderScreenErrorBoundary error={new Error('Map container is being reused by another instance')} retry={jest.fn()} />
      </ErrorBoundary>
    );

    expect(JSON.stringify(toJSON())).toContain('Map container is being reused by another instance');
    console.error = consoleError;
  });
});
