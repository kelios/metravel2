import { resolveExportedFunction } from '@/utils/moduleInterop';

describe('resolveExportedFunction', () => {
  it('returns named export when it is a function', () => {
    const named = jest.fn();
    const fallback = jest.fn();

    const resolved = resolveExportedFunction(
      { getFiltersPanelStyles: named, default: fallback },
      'getFiltersPanelStyles'
    );

    expect(resolved).toBe(named);
  });

  it('falls back to default export when named export is missing', () => {
    const fallback = jest.fn();

    const resolved = resolveExportedFunction(
      { default: fallback },
      'useSingleTravelExport'
    );

    expect(resolved).toBe(fallback);
  });

  it('falls back to default export when named export is not a function', () => {
    const fallback = jest.fn();

    const resolved = resolveExportedFunction(
      { useSingleTravelExport: { broken: true }, default: fallback },
      'useSingleTravelExport'
    );

    expect(resolved).toBe(fallback);
  });

  it('returns null when neither named nor default export is callable', () => {
    const resolved = resolveExportedFunction(
      { getFiltersPanelStyles: { broken: true }, default: null },
      'getFiltersPanelStyles'
    );

    expect(resolved).toBeNull();
  });
});
