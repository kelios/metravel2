// #1828: кнопка «Мои данные» звала `DELETE /user/data/routes/`, а эта ручка
// удаляет ВСЕ путешествия автора вместе с фото и треками и снимает авторство со
// всех совместных. Подтверждение при этом обещало «сохранённые маршруты».
// Набор держит два инварианта, которые и разошлись: копия действия описывает то,
// что делает вызываемая ручка, и разрушительный вызов требует явного второго шага.

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/privacy', () => ({
  requestDataExport: jest.fn(async () => ({ status: 'queued' })),
  deleteUserMessages: jest.fn(async () => null),
  deleteUserRoutes: jest.fn(async () => null),
  revokeUserConsents: jest.fn(async () => null),
}));

jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn(async () => false) }));
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));
jest.mock('@/utils/externalLinks', () => ({ openExternalUrl: jest.fn() }));

jest.mock('@/api/travelUserQueries', () => ({
  fetchMyTravels: jest.fn(async () => ({ items: [], total: 0 })),
  unwrapMyTravelsPayload: jest.fn((payload: { total?: number }) => ({
    items: [],
    total: payload?.total ?? 0,
  })),
}));

const authRef = { userId: 'user-1' as string | null };
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof authRef) => unknown) => selector(authRef),
}));

import { useDataOwnership } from '@/hooks/useDataOwnership';
import { deleteUserRoutes } from '@/api/privacy';
import { confirmAction } from '@/utils/confirmAction';
import { fetchMyTravels } from '@/api/travelUserQueries';
import { resources } from '@/i18n/resources';
import { translate as i18nT } from '@/i18n';

const mockDelete = deleteUserRoutes as jest.MockedFunction<typeof deleteUserRoutes>;
const mockConfirm = confirmAction as jest.MockedFunction<typeof confirmAction>;
const mockCount = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;

const LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false, networkMode: 'always' } },
      })
    }
  >
    {children}
  </QueryClientProvider>
);

const renderDataOwnership = () => renderHook(() => useDataOwnership(), { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  authRef.userId = 'user-1';
  mockConfirm.mockResolvedValue(false);
  mockCount.mockResolvedValue({ total: 0 } as never);
});

describe('#1828 copy of the destructive data-ownership action', () => {
  // Ручка `data/routes` не трогает сохранённые маршруты — обещать их нельзя ни на
  // одной локали, иначе автор снова сотрёт свои статьи, думая, что чистит избранное.
  it('never promises saved routes in any locale', () => {
    const savedRoutePromises = [
      /сохранённые маршруты будут/i,
      /захаваныя маршруты будуць/i,
      /збережені маршрути буде/i,
      /zapisane trasy zostaną/i,
      /saved routes will be/i,
    ];

    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(resources[locale].shared)) {
        if (!key.startsWith('hooks.useDataOwnership.deleteTravels')) continue;
        for (const promise of savedRoutePromises) {
          expect({ locale, key, value }).toEqual({
            locale,
            key,
            value: expect.not.stringMatching(promise),
          });
        }
      }
    }
  });

  // Действие удаляет путешествия — так оно и должно называться на каждой локали.
  it('names travels, not routes, in the button and both confirmation steps', () => {
    const travelWord = {
      ru: /путешеств/i,
      be: /падарожж/i,
      uk: /подорож/i,
      pl: /podróż/i,
      en: /travels/i,
    } as const;

    for (const locale of LOCALES) {
      const shared = resources[locale].shared as Record<string, string>;
      const profile = resources[locale].profile as Record<string, string>;
      const named = [
        profile['components.settings.DataOwnershipSection.deleteTravelsLabel'],
        shared['hooks.useDataOwnership.deleteTravelsTitle'],
        shared['hooks.useDataOwnership.deleteTravelsMessage'],
        shared['hooks.useDataOwnership.deleteTravelsMessageWithCount'],
        shared['hooks.useDataOwnership.deleteTravelsFinalMessage'],
      ];
      for (const value of named) {
        expect({ locale, value }).toEqual({ locale, value: expect.stringMatching(travelWord[locale]) });
      }
    }
  });

  // Отсылать за сохранёнными маршрутами можно только туда, что в продукте
  // действительно так подписано: экран называется «Хочу поехать», не «Избранное».
  it('names the saved-list screen the way the product names it', () => {
    const inventedNames = /избранн|ulubion|favorit|абран|обран/i;

    for (const locale of LOCALES) {
      const shared = resources[locale].shared as Record<string, string>;
      const profile = resources[locale].profile as Record<string, string>;
      const savedListName = shared['app.tabs.favorites.hochu_poehat_d89b6117'];
      const mentions = [
        shared['hooks.useDataOwnership.deleteTravelsMessage'],
        shared['hooks.useDataOwnership.deleteTravelsMessageWithCount'],
        profile['components.settings.DataOwnershipSection.deleteTravelsHint'],
      ];

      for (const value of mentions) {
        expect({ locale, value }).toEqual({
          locale,
          value: expect.stringContaining(savedListName),
        });
        expect({ locale, value }).toEqual({
          locale,
          value: expect.not.stringMatching(inventedNames),
        });
      }
    }
  });

  it('keeps the counted message interpolating the number of affected travels', () => {
    for (const locale of LOCALES) {
      const shared = resources[locale].shared as Record<string, string>;
      expect({
        locale,
        counted: shared['hooks.useDataOwnership.deleteTravelsMessageWithCount'].includes('{{value1}}'),
      }).toEqual({ locale, counted: true });
    }
  });
});

describe('#1828 two-step confirmation before the destructive call', () => {
  it('does not call the endpoint when the first step is dismissed', async () => {
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('does not call the endpoint when only the first step is confirmed', async () => {
    mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockConfirm).toHaveBeenCalledTimes(2);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('calls the endpoint only after both steps are confirmed', async () => {
    mockConfirm.mockResolvedValue(true);
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
  });
});

describe('#1828 busy state while the confirmation is being prepared', () => {
  // Подсчёт идёт до первого диалога: пока он идёт, кнопка обязана быть занятой,
  // иначе нажатие остаётся без ответа, а второе заводит второй цикл подтверждений.
  it('reports the action as running while the count is in flight', async () => {
    let releaseCount: (payload: { total: number }) => void = () => {};
    mockCount.mockImplementation(
      (() => new Promise((resolve) => {
        releaseCount = resolve as (payload: { total: number }) => void;
      })) as never,
    );

    const { result } = renderDataOwnership();
    expect(result.current.isDeletingTravels).toBe(false);

    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = result.current.deleteTravels();
    });

    expect(result.current.isDeletingTravels).toBe(true);
    expect(mockConfirm).not.toHaveBeenCalled();

    await act(async () => {
      releaseCount({ total: 3 });
      await pending;
    });

    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it('ignores a second press while the first one is still counting', async () => {
    mockCount.mockImplementation((() => new Promise(() => {})) as never);
    const { result } = renderDataOwnership();

    await act(async () => {
      void result.current.deleteTravels();
    });
    await act(async () => {
      void result.current.deleteTravels();
    });

    expect(mockCount).toHaveBeenCalledTimes(1);
  });
});

describe('#1828 how many travels the confirmation names', () => {
  it('shows the counted message with the number of affected travels', async () => {
    mockCount.mockResolvedValueOnce({ total: 7 } as never);
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', includeDrafts: true, throwOnError: true }),
    );
    expect(mockConfirm.mock.calls[0][0].message).toBe(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsMessageWithCount', { value1: 7 }),
    );
  });

  // Провалившийся счётчик не имеет права превратиться в честный на вид ноль.
  it('falls back to the countless message when the count request fails', async () => {
    mockCount.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockConfirm.mock.calls[0][0].message).toBe(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsMessage'),
    );
  });

  // Число — уточнение, а не условие показа: подвисший счётчик не имеет права
  // держать нажатую кнопку немой.
  it('asks without the number when the count outlives its budget', async () => {
    jest.useFakeTimers();
    try {
      mockCount.mockImplementation((() => new Promise(() => {})) as never);
      const { result } = renderDataOwnership();

      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = result.current.deleteTravels();
      });
      await act(async () => {
        jest.advanceTimersByTime(2500);
      });
      await act(async () => {
        await pending;
      });

      expect(mockConfirm.mock.calls[0][0].message).toBe(
        i18nT('shared:hooks.useDataOwnership.deleteTravelsMessage'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to the countless message for a session without a user id', async () => {
    authRef.userId = null;
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockCount).not.toHaveBeenCalled();
    expect(mockConfirm.mock.calls[0][0].message).toBe(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsMessage'),
    );
  });
});
