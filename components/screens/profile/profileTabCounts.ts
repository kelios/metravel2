import { useCallback, useRef, useState } from 'react';

import type { ProfileTabCountersDto, UserProfileDto } from '@/api/user';

type Count = number | null | undefined;
type LiveTravelCount = { owner: string | null; generation: object; count: Count };

export function useProfileTravelCountState(owner: string | null) {
  const [state, setState] = useState<LiveTravelCount>(() => ({ owner, generation: {}, count: undefined }));
  if (state.owner !== owner) {
    setState({ owner, generation: {}, count: undefined });
  }
  const generationRef = useRef(state.generation);
  generationRef.current = state.generation;

  const onTotalChange = useCallback((count: number | null) => {
    if (owner === null || generationRef.current !== state.generation) return;
    setState((current) => current.generation === state.generation ? { ...current, count } : current);
  }, [owner, state.generation]);

  return { liveTravelsCount: state.owner === owner && owner !== null ? state.count : undefined, onTotalChange };
}

export function ownerProfileTabCounters(
  profile: Pick<UserProfileDto, 'user' | 'tab_counters'> | null,
  owner: string | null,
): ProfileTabCountersDto | undefined {
  return owner !== null && profile && String(profile.user) === owner
    ? profile.tab_counters ?? undefined
    : undefined;
}

export function resolveProfileTabCounts({
  initial,
  travels,
  published,
  drafts,
  subscribers,
  subscriptions,
  profileDataUpdatedAt = 0,
  subscribersDataUpdatedAt = 0,
  subscriptionsDataUpdatedAt = 0,
}: {
  initial: ProfileTabCountersDto | undefined;
  travels: Count;
  published: Count;
  drafts: Count;
  subscribers: Count;
  subscriptions: Count;
  profileDataUpdatedAt?: number;
  subscribersDataUpdatedAt?: number;
  subscriptionsDataUpdatedAt?: number;
}) {
  const travelCountsConfirmed = travels !== undefined;
  const socialCount = (live: Count, seed: number | undefined, dataUpdatedAt: number): Count =>
    live !== undefined && (seed === undefined || dataUpdatedAt >= profileDataUpdatedAt) ? live : seed;
  return {
    travels: travels === undefined ? initial?.travels : travels,
    publishedTravels: travelCountsConfirmed && published !== undefined ? published : initial?.published,
    draftTravels: travelCountsConfirmed && drafts !== undefined ? drafts : initial?.drafts,
    subscribers: socialCount(subscribers, initial?.subscribers, subscribersDataUpdatedAt),
    subscriptions: socialCount(subscriptions, initial?.subscriptions, subscriptionsDataUpdatedAt),
  };
}
