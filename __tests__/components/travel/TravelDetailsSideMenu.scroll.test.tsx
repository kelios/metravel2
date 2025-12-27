import { styles } from '@/components/travel/details/TravelDetailsContainer';

describe('TravelDetails side menu (web desktop)', () => {
  it('has overflowY auto and a constrained maxHeight so the menu can scroll', () => {
    const desktop = styles.sideMenuWebDesktop as any;

    expect(desktop).toBeTruthy();
    expect(desktop.overflowY).toBe('auto');

    // We expect a calc-based maxHeight that depends on HEADER_OFFSET_DESKTOP.
    // This test should fail if maxHeight is removed or replaced with a non-calc value.
    expect(typeof desktop.maxHeight).toBe('string');
    expect(desktop.maxHeight).toMatch(/^calc\(100vh - \d+px\)$/);

    expect(desktop.overscrollBehavior).toBe('contain');
  });
});
