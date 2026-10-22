import type { Travel } from '@/types/types';
import { normalizeToTravel } from '@/components/profile/travelNormalize';
import { transformTravelToFormData } from '@/utils/travelFormUtils';
import { resolveTravelModerationFeedback } from '@/utils/travelPublicationStatus';

const apiItem = {
  id: 682,
  name: 'Route awaiting corrections',
  slug: 'route-awaiting-corrections',
  description: '<p>Original author text</p>',
  publication_status: 'draft',
  publish: true,
  moderation: true,
  moderation_decision: 'rejected',
  moderation_decision_reason: 'Add the route duration',
  moderation_decided_at: '2026-10-21T09:15:00Z',
};

describe('#2669 — profile and editor hydration of moderation feedback', () => {
  it.each([
    { publication_status: 'draft', moderation_decision: 'rejected', status: 'rejected' },
    { publication_status: 'published', moderation_decision: 'approved', status: 'published' },
  ])('preserves the actual API decision for $publication_status in both author surfaces', ({ status, ...decision }) => {
    const record = { ...apiItem, ...decision };
    const profileTravel = normalizeToTravel(record);
    const editorForm = transformTravelToFormData(record as unknown as Travel);

    for (const hydrated of [profileTravel, editorForm]) {
      expect(hydrated).toMatchObject({
        ...decision,
        description: apiItem.description,
        moderation_decision_reason: apiItem.moderation_decision_reason,
        moderation_decided_at: apiItem.moderation_decided_at,
      });
      expect(resolveTravelModerationFeedback(hydrated).status).toBe(status);
    }
  });

  it.each([
    {},
    { moderation_decision: null, moderation_decision_reason: null, moderation_decided_at: null },
    { moderation_decision: 'unknown', moderation_decision_reason: 42, moderation_decided_at: {} },
  ])('uses the same empty metadata contract in profile and editor for %p', (metadata) => {
    const record = { id: 682, name: apiItem.name, publication_status: 'draft', ...metadata };
    for (const hydrated of [normalizeToTravel(record), transformTravelToFormData(record as unknown as Travel)]) {
      expect(hydrated).toMatchObject({
        moderation_decision: null, moderation_decision_reason: '', moderation_decided_at: null,
      });
      expect(resolveTravelModerationFeedback(hydrated)).toEqual({ status: 'draft', reason: '', decidedAt: null });
    }
  });

  it('keeps explicit canonical null invalid despite a healthy camel-case alias, legacy flags and old rejection', () => {
    const record = { ...apiItem, publication_status: null, publicationStatus: 'published' };
    for (const hydrated of [normalizeToTravel(record), transformTravelToFormData(record as unknown as Travel)]) {
      expect(hydrated.publication_status).toBeNull();
      expect(resolveTravelModerationFeedback(hydrated)).toEqual({ status: null, reason: '', decidedAt: null });
    }
  });

  it('retains legacy rejection feedback only when the canonical status is absent', () => {
    const record = { ...apiItem, publication_status: undefined, publish: false, moderation: false };
    for (const hydrated of [normalizeToTravel(record), transformTravelToFormData(record as unknown as Travel)]) {
      expect(resolveTravelModerationFeedback(hydrated)).toEqual({
        status: 'rejected', reason: apiItem.moderation_decision_reason, decidedAt: apiItem.moderation_decided_at,
      });
    }
  });
});
