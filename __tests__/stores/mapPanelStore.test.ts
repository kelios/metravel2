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

  it('stores requestedTab for open requests', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(3_000);

    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    useMapPanelStore.getState().requestOpen('list');
    expect(useMapPanelStore.getState().requestedTab).toBe('list');

    (Date.now as jest.Mock).mockReturnValue(3_500);
    useMapPanelStore.getState().requestOpen();
    expect(useMapPanelStore.getState().requestedTab).toBe('filters');
  });

  it('routes every intent through one monotonic commandNonce', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(4_000);

    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    useMapPanelStore.getState().requestOpen('list');
    let s = useMapPanelStore.getState();
    expect(s.commandNonce).toBe(1);
    expect(s.command).toEqual({ kind: 'open', tab: 'list' });

    (Date.now as jest.Mock).mockReturnValue(4_500);
    useMapPanelStore.getState().requestToggle();
    s = useMapPanelStore.getState();
    expect(s.commandNonce).toBe(2);
    expect(s.command.kind).toBe('toggle');

    (Date.now as jest.Mock).mockReturnValue(5_000);
    useMapPanelStore.getState().requestCollapse();
    s = useMapPanelStore.getState();
    expect(s.commandNonce).toBe(3);
    expect(s.command.kind).toBe('collapse');
  });

  it('throttles requestCollapse', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(6_000);

    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    useMapPanelStore.getState().requestCollapse();
    useMapPanelStore.getState().requestCollapse();
    expect(useMapPanelStore.getState().commandNonce).toBe(1);

    (Date.now as jest.Mock).mockReturnValue(6_500);
    useMapPanelStore.getState().requestCollapse();
    expect(useMapPanelStore.getState().commandNonce).toBe(2);
  });

  it('bumps searchFocusNonce on every requestSearchFocus (#225 autofocus signal)', async () => {
    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    expect(useMapPanelStore.getState().searchFocusNonce).toBe(0);

    // Not throttled: each tap on «Искать места» must reliably re-focus the input.
    useMapPanelStore.getState().requestSearchFocus();
    useMapPanelStore.getState().requestSearchFocus();
    expect(useMapPanelStore.getState().searchFocusNonce).toBe(2);
  });

  it('latches pendingSearchFocus so a freshly-mounted input can grab focus (#225)', async () => {
    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    expect(useMapPanelStore.getState().pendingSearchFocus).toBe(false);

    // Tap «Искать места» — sheet switches list→filters and mounts the input AFTER
    // the nonce already bumped, so the latch (not the nonce) carries the intent.
    useMapPanelStore.getState().requestSearchFocus();
    expect(useMapPanelStore.getState().pendingSearchFocus).toBe(true);

    // The input clears the latch once it has grabbed focus.
    useMapPanelStore.getState().consumeSearchFocus();
    expect(useMapPanelStore.getState().pendingSearchFocus).toBe(false);
  });

  it('consumeSearchFocus is a no-op when nothing is pending (#225)', async () => {
    const { useMapPanelStore } = await import('@/stores/mapPanelStore');

    const before = useMapPanelStore.getState();
    before.consumeSearchFocus();
    expect(useMapPanelStore.getState().pendingSearchFocus).toBe(false);
  });
});
