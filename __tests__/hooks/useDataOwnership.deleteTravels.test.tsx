// #1828: кнопка «Мои данные» звала `DELETE /user/data/routes/`, а эта ручка
// удаляет ВСЕ путешествия автора вместе с фото и треками и снимает авторство со
// всех совместных. Подтверждение при этом обещало «сохранённые маршруты».
// Набор держит два инварианта, которые и разошлись: копия действия описывает то,
// что делает вызываемая ручка, и разрушительный вызов требует явного второго шага.
//
// #1878: фронт переехал на канонический `DELETE /user/data/authored-content/`, а
// числа берёт из `GET` того же пути. Третий инвариант: подтверждение называет
// ровно то, что вернул сервер, а при отказе счётчика не выдумывает число.

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/api/privacy', () => ({
  requestDataExport: jest.fn(async () => ({ status: 'queued' })),
  deleteUserMessages: jest.fn(async () => null),
  deleteAuthoredContent: jest.fn(async () => null),
  fetchAuthoredContentSummary: jest.fn(async () => ({ travels_to_delete: 0, co_authored_to_detach: 0 })),
  revokeUserConsents: jest.fn(async () => null),
}));

jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn(async () => false) }));
jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));
jest.mock('@/utils/externalLinks', () => ({ openExternalUrl: jest.fn() }));

const authRef = { userId: 'user-1' as string | null };
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof authRef) => unknown) => selector(authRef),
}));

import { useDataOwnership } from '@/hooks/useDataOwnership';
import { deleteAuthoredContent, fetchAuthoredContentSummary } from '@/api/privacy';
import { confirmAction } from '@/utils/confirmAction';
import { resources } from '@/i18n/resources';
import { i18n, translate as i18nT } from '@/i18n';
import type { AuthoredContentSummaryDto } from '@/api/privacy';

const mockDelete = deleteAuthoredContent as jest.MockedFunction<typeof deleteAuthoredContent>;
const mockConfirm = confirmAction as jest.MockedFunction<typeof confirmAction>;
const mockCount = fetchAuthoredContentSummary as jest.MockedFunction<typeof fetchAuthoredContentSummary>;

const LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const;

/** Обе половины счётчика во всех формах числа. */
const AFFECTED_KEYS = [
  'hooks.useDataOwnership.deleteTravelsAffectedOwnedOne',
  'hooks.useDataOwnership.deleteTravelsAffectedOwnedFew',
  'hooks.useDataOwnership.deleteTravelsAffectedOwnedMany',
  'hooks.useDataOwnership.deleteTravelsAffectedSharedOne',
  'hooks.useDataOwnership.deleteTravelsAffectedSharedFew',
  'hooks.useDataOwnership.deleteTravelsAffectedSharedMany',
] as const;

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
  mockCount.mockResolvedValue({ travels_to_delete: 0, co_authored_to_detach: 0 });
});

describe('#1828 copy of the destructive data-ownership action', () => {
  // `data/authored-content` не трогает сохранённые маршруты — обещать их нельзя ни
  // на одной локали, иначе автор снова сотрёт свои статьи, думая, что чистит избранное.
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
      en: /travel/i,
    } as const;

    for (const locale of LOCALES) {
      const shared = resources[locale].shared as Record<string, string>;
      const profile = resources[locale].profile as Record<string, string>;
      const named = [
        profile['components.settings.DataOwnershipSection.deleteTravelsLabel'],
        shared['hooks.useDataOwnership.deleteTravelsTitle'],
        shared['hooks.useDataOwnership.deleteTravelsMessage'],
        shared['hooks.useDataOwnership.deleteTravelsFinalMessage'],
        ...AFFECTED_KEYS.map((key) => shared[key]),
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
        shared['hooks.useDataOwnership.deleteTravelsMessageCounted'],
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

  it('keeps every counted string interpolating its value', () => {
    for (const locale of LOCALES) {
      const shared = resources[locale].shared as Record<string, string>;
      for (const key of [...AFFECTED_KEYS, 'hooks.useDataOwnership.deleteTravelsMessageCounted']) {
        expect({ locale, key, counted: shared[key]?.includes('{{value1}}') }).toEqual({
          locale,
          key,
          counted: true,
        });
      }
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
    let releaseCount: (payload: AuthoredContentSummaryDto) => void = () => {};
    mockCount.mockImplementation(
      (() => new Promise((resolve) => {
        releaseCount = resolve as (payload: AuthoredContentSummaryDto) => void;
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
      releaseCount({ travels_to_delete: 3, co_authored_to_detach: 0 });
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

describe('#1878 how many travels the confirmation names', () => {
  it('names both halves of the summary the server returned', async () => {
    mockCount.mockResolvedValueOnce({ travels_to_delete: 7, co_authored_to_detach: 2 });
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    const message = mockConfirm.mock.calls[0][0].message;
    expect(message).toBe(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsMessageCounted', {
        value1: `${i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedOwnedMany', { value1: '7' })} ${i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedSharedFew', { value1: '2' })}`,
      }),
    );
    expect(message).toContain('7');
    expect(message).toContain('2');
  });

  // Общий счётчик «Мои путешествия» складывает личные и совместные, а удаляются
  // только первые: числа обязаны приходить из ручки, которая знает разделение.
  it('reads the numbers from the endpoint that performs the deletion', async () => {
    mockCount.mockResolvedValueOnce({ travels_to_delete: 1, co_authored_to_detach: 0 });
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockCount).toHaveBeenCalledWith();
  });

  // «Удалить 0 путешествий» читается как ошибка, а не как факт.
  it('never prints a zero half of the summary', async () => {
    mockCount.mockResolvedValueOnce({ travels_to_delete: 0, co_authored_to_detach: 3 });
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    const message = mockConfirm.mock.calls[0][0].message;
    expect(message).toContain(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedSharedMany', { value1: '3' }),
    );
    expect(message).not.toContain(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsAffectedOwnedMany', { value1: '0' }),
    );
  });

  // Оба нуля — считать нечего, и подтверждение обязано вернуться к копии без чисел.
  it('falls back to the countless message when nothing is affected', async () => {
    mockCount.mockResolvedValueOnce({ travels_to_delete: 0, co_authored_to_detach: 0 });
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockConfirm.mock.calls[0][0].message).toBe(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsMessage'),
    );
  });

  // Мусор вместо числа — это тот же отказ счётчика, а не «0» и не «NaN».
  it('falls back to the countless message when the summary is not numeric', async () => {
    mockCount.mockResolvedValueOnce({ travels_to_delete: null, co_authored_to_detach: 4 } as never);
    const { result } = renderDataOwnership();

    await act(async () => {
      await result.current.deleteTravels();
    });

    expect(mockConfirm.mock.calls[0][0].message).toBe(
      i18nT('shared:hooks.useDataOwnership.deleteTravelsMessage'),
    );
  });

  // Числительные склоняются во всех пяти локалях: 1, 2 и 5 обязаны дать разные
  // формы там, где язык их различает, и ни одна не имеет права остаться ключом.
  it('declines both numbers in every locale', async () => {
    const original = i18n.language;
    // Пять одинаковых текстов означали бы, что переключение локали не сработало и
    // набор пять раз проверил RU.
    const perLocale = new Set<string>();
    try {
      for (const locale of LOCALES) {
        await act(async () => {
          await i18n.changeLanguage(locale);
        });

        const rendered: string[] = [];
        for (const count of [1, 2, 5]) {
          mockConfirm.mockClear();
          mockCount.mockResolvedValueOnce({ travels_to_delete: count, co_authored_to_detach: count });
          const { result } = renderDataOwnership();
          await act(async () => {
            await result.current.deleteTravels();
          });
          const message = mockConfirm.mock.calls[0][0].message;
          expect({ locale, count, message }).toEqual({
            locale,
            count,
            message: expect.stringContaining(String(count)),
          });
          expect({ locale, count, message }).toEqual({
            locale,
            count,
            message: expect.not.stringMatching(/deleteTravels|\{\{/),
          });
          // Само число из сравнения форм убирается: иначе «1» против «5» отличало бы
          // тексты и без всякого склонения.
          rendered.push(message.replace(/\d+/g, '#'));
        }
        perLocale.add(rendered[0]);

        // Один и тот же текст на 1 и 5 означает, что склонение не подключено.
        expect({ locale, singularEqualsPlural: rendered[0] === rendered[2] }).toEqual({
          locale,
          singularEqualsPlural: false,
        });
      }
      expect(perLocale.size).toBe(LOCALES.length);
    } finally {
      await act(async () => {
        await i18n.changeLanguage(original);
      });
    }
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
