import type { Href } from 'expo-router';
import type { TravelFormData } from '@/types/types';

export const QUICK_DRAFT_FALLBACK_ROUTE = '/metravel' satisfies Href;

export const buildQuickDraftRoute = (
  savedTravel: Pick<TravelFormData, 'id'> | null | undefined,
): Href => {
  const rawId = savedTravel?.id;
  if (rawId === null || typeof rawId === 'undefined') return QUICK_DRAFT_FALLBACK_ROUTE;

  const id = String(rawId).trim();
  if (!id) return QUICK_DRAFT_FALLBACK_ROUTE;

  return `/travel/${encodeURIComponent(id)}` as Href;
};
