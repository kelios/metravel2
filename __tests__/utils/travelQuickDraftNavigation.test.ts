import { buildQuickDraftRoute, QUICK_DRAFT_FALLBACK_ROUTE } from '@/utils/travelQuickDraftNavigation';

describe('travelQuickDraftNavigation', () => {
  it('opens the saved draft edit route when backend returns an id', () => {
    expect(buildQuickDraftRoute({ id: 123 } as any)).toBe('/travel/123');
    expect(buildQuickDraftRoute({ id: 'draft 123' } as any)).toBe('/travel/draft%20123');
  });

  it('falls back when save response has no usable id', () => {
    expect(buildQuickDraftRoute(null)).toBe(QUICK_DRAFT_FALLBACK_ROUTE);
    expect(buildQuickDraftRoute({ id: null } as any)).toBe(QUICK_DRAFT_FALLBACK_ROUTE);
    expect(buildQuickDraftRoute({ id: '   ' } as any)).toBe(QUICK_DRAFT_FALLBACK_ROUTE);
  });
});
