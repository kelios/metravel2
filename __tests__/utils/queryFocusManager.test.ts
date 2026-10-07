// LC-1: на Android/iOS `focusManager` React Query подключён к `AppState`;
// без этого refetch по фокусу был мёртвой настройкой, и приложение, вернувшееся
// на передний план через несколько часов, показывало устаревшие списки.

import { focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { __resetQueryFocusManagerForTests, setupQueryFocusManager } from '@/utils/queryFocusManager';

type ChangeHandler = (status: string) => void;

describe('utils/queryFocusManager', () => {
  const originalPlatformOS = Platform.OS;
  let handlers: ChangeHandler[];
  let remove: jest.Mock;
  let addEventListener: jest.SpyInstance;

  beforeEach(() => {
    handlers = [];
    remove = jest.fn();
    addEventListener = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((event: string, handler: ChangeHandler) => {
        if (event === 'change') handlers.push(handler);
        return { remove } as any;
      }) as any);
    __resetQueryFocusManagerForTests();
  });

  afterEach(() => {
    // Отвязываем `AppState`-слушатель и возвращаем дефолт (`undefined` →
    // решение по `document.visibilityState`), чтобы не влиять на другие наборы.
    focusManager.setEventListener(() => undefined);
    focusManager.setFocused(undefined);
    __resetQueryFocusManagerForTests();
    addEventListener.mockRestore();
    Platform.OS = originalPlatformOS;
  });

  it('web: does not touch AppState and leaves the default focus source', () => {
    Platform.OS = 'web';

    setupQueryFocusManager();

    expect(addEventListener).not.toHaveBeenCalled();
  });

  it.each(['android', 'ios'] as const)('%s: AppState active/background drives focusManager', (platform) => {
    Platform.OS = platform;

    setupQueryFocusManager();
    setupQueryFocusManager(); // идемпотентно: один слушатель на процесс

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    handlers.forEach((handler) => handler('background'));
    expect(focusManager.isFocused()).toBe(false);

    handlers.forEach((handler) => handler('active'));
    expect(focusManager.isFocused()).toBe(true);

    handlers.forEach((handler) => handler('inactive'));
    expect(focusManager.isFocused()).toBe(false);
  });

  it('native: replacing the listener removes the AppState subscription', () => {
    Platform.OS = 'android';

    setupQueryFocusManager();
    focusManager.setEventListener(() => undefined);

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
