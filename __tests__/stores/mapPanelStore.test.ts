import { jest } from '@jest/globals';

describe('mapPanelStore throttle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('throttles requestToggle', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    const state1 = useMapPanelStore.getState();
    expect(state1.toggleNonce).toBe(0);

    state1.requestToggle();
    state1.requestToggle();

    expect(useMapPanelStore.getState().toggleNonce).toBe(1);

    (Date.now as jest.Mock).mockReturnValue(1_500);
    useMapPanelStore.getState().requestToggle();
    expect(useMapPanelStore.getState().toggleNonce).toBe(2);
  });

  it('throttles requestOpen', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_000);

    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    const state1 = useMapPanelStore.getState();
    expect(state1.openNonce).toBe(0);

    state1.requestOpen();
    state1.requestOpen();

    expect(useMapPanelStore.getState().openNonce).toBe(1);

    (Date.now as jest.Mock).mockReturnValue(2_500);
    useMapPanelStore.getState().requestOpen();
    expect(useMapPanelStore.getState().openNonce).toBe(2);
  });
});
