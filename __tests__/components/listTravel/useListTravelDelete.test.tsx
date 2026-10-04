// #2127: удаление путешествия — один канал вопросов и сообщений.
// Web: ConfirmDialog в ListTravelLayout (deleteId), ошибка внутри диалога.
// Native: confirmAction (системный Alert), отказ сервера — тостом; повторное
// «Удалить» после закрытия Alert без выбора снова спрашивает (раньше молчало).
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useListTravelDelete } from '@/components/listTravel/hooks/useListTravelDelete';
import { showToastMessage } from '@/utils/toast';
import { deleteTravel } from '@/api/travelsApi';

jest.mock('@/utils/toast', () => ({
  ...jest.requireActual('@/utils/toast'),
  showToastMessage: jest.fn(async () => undefined),
}));

jest.mock('@/api/travelsApi', () => ({
  deleteTravel: jest.fn(async () => undefined),
}));

type AlertButton = { text: string; style?: string; onPress?: () => void };

const originalPlatform = Platform.OS;
const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os });

function renderDeleteHook() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useListTravelDelete(), { wrapper });
}

describe('useListTravelDelete (#2127)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    setPlatform(originalPlatform);
  });

  const alertButtons = (call = 0) => alertSpy.mock.calls[call][2] as AlertButton[];

  it('web: вопрос — ConfirmDialog через deleteId, системный Alert не трогается', () => {
    setPlatform('web');
    const { result } = renderDeleteHook();

    act(() => result.current.requestDelete(42));

    expect(result.current.deleteId).toBe(42);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('native: «Удалить» в confirmAction удаляет маршрут и показывает тост успеха', async () => {
    setPlatform('ios');
    const { result } = renderDeleteHook();

    act(() => result.current.requestDelete(42));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(deleteTravel).not.toHaveBeenCalled();

    await act(async () => {
      alertButtons().find((b) => b.style === 'destructive')?.onPress?.();
    });

    await waitFor(() => expect(deleteTravel).toHaveBeenCalledWith('42'));
    await waitFor(() => expect(showToastMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })));
  });

  it('native: «Отмена» ничего не удаляет; повторный запрос того же маршрута снова спрашивает', async () => {
    setPlatform('android');
    const { result } = renderDeleteHook();

    act(() => result.current.requestDelete(7));
    await act(async () => {
      (alertSpy.mock.calls[0][3] as { onDismiss?: () => void }).onDismiss?.();
    });
    act(() => result.current.requestDelete(7));

    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(deleteTravel).not.toHaveBeenCalled();
  });

  it('native: отказ сервера — причина тостом, а не вторым Alert', async () => {
    setPlatform('ios');
    (deleteTravel as jest.Mock).mockRejectedValueOnce(new Error('HTTP 500'));
    const { result } = renderDeleteHook();

    act(() => result.current.requestDelete(42));
    await act(async () => {
      alertButtons().find((b) => b.style === 'destructive')?.onPress?.();
    });

    await waitFor(() =>
      expect(showToastMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', position: 'bottom' })),
    );
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(result.current.deleteId).toBeNull();
  });
});
