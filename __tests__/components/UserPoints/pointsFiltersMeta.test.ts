import { buildActiveFilterChips, computeHasActiveFilters } from '@/components/UserPoints/pointsFiltersMeta';

describe('pointsFiltersMeta', () => {
  it('detects active filters from preset/search/radius', () => {
    expect(
      computeHasActiveFilters({
        activePresetId: null,
        filters: { radiusKm: 100, statuses: [], categoryIds: [], colors: [] },
        searchQuery: '',
      })
    ).toBe(false);

    expect(
      computeHasActiveFilters({
        activePresetId: 'nature',
        filters: { radiusKm: 100, statuses: [], categoryIds: [], colors: [] },
        searchQuery: '',
      })
    ).toBe(true);
  });

  it('builds filter chips with mapped labels', () => {
    const chips = buildActiveFilterChips({
      activePreset: { label: 'Природа' },
      categoryIdToName: new Map([['1', 'Озеро']]),
      filters: {
        radiusKm: 20,
        statuses: ['planning' as any],
        categoryIds: ['1'],
        colors: ['blue'],
      },
      searchQuery: 'Минск',
      statusLabels: { planning: 'План' },
    });

    expect(chips.some((c) => c.key === 'preset')).toBe(true);
    expect(chips.some((c) => c.key === 'search')).toBe(true);
    expect(chips.some((c) => c.key === 'radius')).toBe(true);
    expect(chips.some((c) => c.key === 'status-planning')).toBe(true);
    expect(chips.some((c) => c.key === 'category-1')).toBe(true);
    expect(chips.some((c) => c.key === 'color-blue')).toBe(true);
  });
});
