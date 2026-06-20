// utils/tripAnalytics.ts
// Аналитика воронки публичных поездок (Sprint 14, #462). North Star — число
// успешно укомплектованных поездок; KPI — заявки и conversion заявка→одобрение.
// События уходят в GA4/Yandex через sendAnalyticsEvent (учитывает consent).

import { sendAnalyticsEvent } from '@/utils/analytics';

export const TRIP_EVENTS = {
  // Воронка (#462)
  published: 'public_trip_published',
  applicationSubmitted: 'trip_application_submitted',
  applicationApproved: 'application_approved',
  applicationRejected: 'application_rejected',
  // Каталог
  catalogViewed: 'public_trips_catalog_viewed',
  tripViewed: 'public_trip_viewed',
  // Featured/boosted (#463)
  featuredImpression: 'featured_trip_impression',
  featuredClick: 'featured_trip_click',
} as const;

export function trackTripCatalogViewed(count: number): void {
  void sendAnalyticsEvent(TRIP_EVENTS.catalogViewed, { trips_count: count });
}

export function trackTripViewed(tripId: number, featured: boolean): void {
  void sendAnalyticsEvent(TRIP_EVENTS.tripViewed, { trip_id: tripId, featured });
}

export function trackTripPublished(tripId: number): void {
  void sendAnalyticsEvent(TRIP_EVENTS.published, { trip_id: tripId });
}

export function trackApplicationSubmitted(tripId: number): void {
  void sendAnalyticsEvent(TRIP_EVENTS.applicationSubmitted, { trip_id: tripId });
}

export function trackApplicationDecision(
  decision: 'approve' | 'reject',
  tripId: number,
  applicationId: number,
): void {
  const event =
    decision === 'approve'
      ? TRIP_EVENTS.applicationApproved
      : TRIP_EVENTS.applicationRejected;
  void sendAnalyticsEvent(event, { trip_id: tripId, application_id: applicationId });
}

export function trackFeaturedImpression(tripId: number): void {
  void sendAnalyticsEvent(TRIP_EVENTS.featuredImpression, { trip_id: tripId });
}

export function trackFeaturedClick(tripId: number): void {
  void sendAnalyticsEvent(TRIP_EVENTS.featuredClick, { trip_id: tripId });
}
