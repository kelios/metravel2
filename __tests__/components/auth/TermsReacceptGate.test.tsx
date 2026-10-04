import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import TermsReacceptGate from '@/components/auth/TermsReacceptGate';
import { useAuth } from '@/context/AuthContext';

// #2132: вошедший аккаунт с `terms_accepted_current=false` видит экран
// повторного согласия; ошибка записи показывается, а не глотается.

let mockPathname = '/';

jest.mock('@/context/AuthContext');
jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  usePathname: () => mockPathname,
}));
jest.mock('@/api/consent', () => ({
  acceptTerms: jest.fn(),
  fetchTermsAcceptedCurrent: jest.fn(),
}));

const { acceptTerms, fetchTermsAcceptedCurrent } = jest.requireMock('@/api/consent') as {
  acceptTerms: jest.Mock;
  fetchTermsAcceptedCurrent: jest.Mock;
};

const logout = jest.fn();

const renderGate = (auth: { isAuthenticated: boolean; userId: string | null }) => {
  (useAuth as jest.Mock).mockReturnValue({ ...auth, logout });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TermsReacceptGate />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/';
});

it('гостю ничего не показывает и /user/me/ не спрашивает', async () => {
  const screen = renderGate({ isAuthenticated: false, userId: null });

  await waitFor(() => expect(fetchTermsAcceptedCurrent).not.toHaveBeenCalled());
  expect(screen.queryByTestId('terms-reaccept-sheet')).toBeNull();
});

it.each([true, null])('при terms_accepted_current=%s лист не показывается', async (value) => {
  fetchTermsAcceptedCurrent.mockResolvedValue(value);
  const screen = renderGate({ isAuthenticated: true, userId: '7' });

  await waitFor(() => expect(fetchTermsAcceptedCurrent).toHaveBeenCalled());
  expect(screen.queryByTestId('terms-reaccept-sheet')).toBeNull();
});

it('без текущего согласия: принять можно только после галки, после записи лист уходит', async () => {
  fetchTermsAcceptedCurrent.mockResolvedValueOnce(false).mockResolvedValue(true);
  acceptTerms.mockResolvedValue(undefined);
  const screen = renderGate({ isAuthenticated: true, userId: '7' });

  const accept = await screen.findByTestId('terms-reaccept-accept');
  expect(accept.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

  fireEvent.press(screen.getByTestId('terms-reaccept-gate-checkbox'));
  fireEvent.press(screen.getByTestId('terms-reaccept-accept'));

  await waitFor(() => expect(acceptTerms).toHaveBeenCalledWith('1'));
  await waitFor(() => expect(screen.queryByTestId('terms-reaccept-sheet')).toBeNull());
});

it('ошибка записи видна пользователю, лист остаётся', async () => {
  fetchTermsAcceptedCurrent.mockResolvedValue(false);
  acceptTerms.mockRejectedValue(new Error('offline'));
  const screen = renderGate({ isAuthenticated: true, userId: '7' });

  fireEvent.press(await screen.findByTestId('terms-reaccept-gate-checkbox'));
  fireEvent.press(screen.getByTestId('terms-reaccept-accept'));

  expect(await screen.findByTestId('terms-reaccept-error')).toBeTruthy();
  expect(screen.getByTestId('terms-reaccept-sheet')).toBeTruthy();
});

it('на странице условий лист не перекрывает текст', async () => {
  mockPathname = '/terms';
  fetchTermsAcceptedCurrent.mockResolvedValue(false);
  const screen = renderGate({ isAuthenticated: true, userId: '7' });

  await waitFor(() => expect(fetchTermsAcceptedCurrent).toHaveBeenCalled());
  expect(screen.queryByTestId('terms-reaccept-sheet')).toBeNull();
});
