import { act, renderHook } from '@testing-library/react-native';

import { ownerProfileTabCounters, resolveProfileTabCounts, useProfileTravelCountState } from '@/components/screens/profile/profileTabCounts';

const counters = { travels: 12, published: 9, drafts: 3, subscribers: 5, subscriptions: 7 };
const pending = { travels: undefined, published: undefined, drafts: undefined, subscribers: undefined, subscriptions: undefined };

describe('profile tab counters', () => {
  it('uses the owner profile counters in the first render, before the lists arrive', () => {
    const { result } = renderHook(() => {
      const { liveTravelsCount } = useProfileTravelCountState('104');
      return resolveProfileTabCounts({
        ...pending,
        initial: ownerProfileTabCounters({ user: 104, tab_counters: counters }, '104'),
        travels: liveTravelsCount,
        // The legacy section may still classify its initial empty array as complete.
        published: 0,
        drafts: 0,
      });
    });

    expect(result.current).toEqual({ travels: 12, publishedTravels: 9, draftTravels: 3, subscribers: 5, subscriptions: 7 });
  });

  it('keeps missing, private and other-owner profile counters unknown', () => {
    expect(ownerProfileTabCounters({ user: 104 }, '104')).toBeUndefined();
    expect(ownerProfileTabCounters({ user: 104, tab_counters: null }, '104')).toBeUndefined();
    expect(ownerProfileTabCounters({ user: 104, tab_counters: counters }, '105')).toBeUndefined();
    expect(ownerProfileTabCounters({ user: 104, tab_counters: counters }, null)).toBeUndefined();
    expect(resolveProfileTabCounts({ ...pending, initial: undefined })).toEqual({
      travels: undefined, publishedTravels: undefined, draftTravels: undefined, subscribers: undefined, subscriptions: undefined,
    });
  });

  it('lets confirmed zero and unavailable values override the profile seed', () => {
    expect(resolveProfileTabCounts({ initial: counters, travels: 0, published: 0, drafts: 0, subscribers: 0, subscriptions: null })).toEqual({
      travels: 0, publishedTravels: 0, draftTravels: 0, subscribers: 0, subscriptions: null,
    });
    expect(resolveProfileTabCounts({ initial: counters, travels: null, published: null, drafts: null, subscribers: undefined, subscriptions: undefined })).toEqual({
      travels: null, publishedTravels: null, draftTravels: null, subscribers: 5, subscriptions: 7,
    });
  });

  it('updates totals after deletion without losing the confirmed count on another render', () => {
    const { result, rerender } = renderHook(() => useProfileTravelCountState('104'));
    act(() => result.current.onTotalChange(12));
    act(() => result.current.onTotalChange(11));
    rerender({});
    expect(result.current.liveTravelsCount).toBe(11);
    act(() => result.current.onTotalChange(null));
    expect(result.current.liveTravelsCount).toBeNull();
  });

  it('uses the newer source independently for each social counter, including confirmed zero', () => {
    expect(resolveProfileTabCounts({
      ...pending, initial: counters, subscribers: 0, subscriptions: 0,
      profileDataUpdatedAt: 200, subscribersDataUpdatedAt: 100, subscriptionsDataUpdatedAt: 300,
    })).toMatchObject({ subscribers: 5, subscriptions: 0 });
    expect(resolveProfileTabCounts({
      ...pending, initial: counters, subscribers: 0, subscriptions: 0,
      profileDataUpdatedAt: 200, subscribersDataUpdatedAt: 200, subscriptionsDataUpdatedAt: 200,
    })).toMatchObject({ subscribers: 0, subscriptions: 0 });
  });

  it('retains known cached social counts without a profile seed', () => {
    expect(resolveProfileTabCounts({
      ...pending, initial: undefined, subscribers: 0, subscriptions: 2,
      profileDataUpdatedAt: 200, subscribersDataUpdatedAt: 100, subscriptionsDataUpdatedAt: 100,
    })).toMatchObject({ subscribers: 0, subscriptions: 2 });
  });

  it('retains newer known profile counts on a no-data list failure, or shows unavailable without a seed', () => {
    const noDataError = { ...pending, subscribers: null, subscriptions: null, profileDataUpdatedAt: 200 };
    expect(resolveProfileTabCounts({ ...noDataError, initial: counters })).toMatchObject({ subscribers: 5, subscriptions: 7 });
    expect(resolveProfileTabCounts({ ...noDataError, initial: undefined })).toMatchObject({ subscribers: null, subscriptions: null });
  });

  it('uses the new owner seed before old publication values or a late callback can override it', () => {
    const { result, rerender } = renderHook(({ owner }) => useProfileTravelCountState(owner), { initialProps: { owner: '104' as string | null } });
    const oldCallback = result.current.onTotalChange;
    act(() => oldCallback(12));
    rerender({ owner: '105' });
    expect(result.current.liveTravelsCount).toBeUndefined();
    act(() => oldCallback(90));
    expect(result.current.liveTravelsCount).toBeUndefined();
    expect(resolveProfileTabCounts({ initial: counters, ...pending, travels: result.current.liveTravelsCount, published: 80, drafts: null })).toMatchObject({
      travels: 12, publishedTravels: 9, draftTravels: 3,
    });
    act(() => result.current.onTotalChange(6));
    expect(result.current.liveTravelsCount).toBe(6);
  });

  it('rejects a late callback from the old session after logout and login with the same owner', () => {
    const { result, rerender } = renderHook(({ owner }) => useProfileTravelCountState(owner), { initialProps: { owner: '104' as string | null } });
    const oldCallback = result.current.onTotalChange;
    act(() => oldCallback(12));
    rerender({ owner: null });
    expect(result.current.liveTravelsCount).toBeUndefined();
    rerender({ owner: '104' });
    act(() => oldCallback(90));
    expect(result.current.liveTravelsCount).toBeUndefined();
    act(() => result.current.onTotalChange(5));
    expect(result.current.liveTravelsCount).toBe(5);
  });
});
