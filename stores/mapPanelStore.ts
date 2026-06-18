import { create } from 'zustand';

export type MapPanelRequestedTab = 'filters' | 'list';

/**
 * Unified panel command stream.
 *
 * Replaces the previous trio of independent nonces (openNonce / toggleNonce /
 * collapseNonce, the last living in bottomSheetStore). Every panel intent now
 * flows through a single monotonic `commandNonce` carrying a `command`
 * descriptor, so the "which tab / which snap" decision has one home and
 * consumers react to one signal instead of three.
 *
 * - `open`   — open the panel; `tab` picks list vs filters/search.
 * - `toggle` — toggle the mobile sheet open/collapsed.
 * - `collapse` — force-collapse the mobile sheet (used by map/route layers).
 */
export type MapPanelCommandKind = 'open' | 'toggle' | 'collapse';

export interface MapPanelCommand {
  kind: MapPanelCommandKind;
  tab: MapPanelRequestedTab;
}

interface MapPanelState {
  /** Monotonic counter — bumped on every accepted command. */
  commandNonce: number;
  /** The most recently accepted command. */
  command: MapPanelCommand;

  /** Open the panel to the given tab (default: filters). */
  requestOpen: (tab?: MapPanelRequestedTab) => void;
  /** Toggle the mobile sheet open/collapsed. */
  requestToggle: () => void;
  /** Force-collapse the mobile sheet. */
  requestCollapse: () => void;

  // --- Backwards-compatible selectors (derived from the unified stream) ---
  /** @deprecated read `commandNonce` + `command.kind === 'open'` instead. */
  openNonce: number;
  /** @deprecated read `command.tab` instead. */
  requestedTab: MapPanelRequestedTab;
  /** @deprecated read `commandNonce` + `command.kind === 'toggle'` instead. */
  toggleNonce: number;
}

let lastOpenTs = 0;
let lastToggleTs = 0;
let lastCollapseTs = 0;
const THROTTLE_MS = 300;

export const useMapPanelStore = create<MapPanelState>((set) => ({
  commandNonce: 0,
  command: { kind: 'open', tab: 'filters' },

  openNonce: 0,
  requestedTab: 'filters',
  toggleNonce: 0,

  requestOpen: (tab = 'filters') =>
    set((s) => {
      const now = Date.now();
      if (now - lastOpenTs < THROTTLE_MS) return s;
      lastOpenTs = now;
      return {
        commandNonce: s.commandNonce + 1,
        command: { kind: 'open', tab },
        openNonce: s.openNonce + 1,
        requestedTab: tab,
      };
    }),

  requestToggle: () =>
    set((s) => {
      const now = Date.now();
      if (now - lastToggleTs < THROTTLE_MS) return s;
      lastToggleTs = now;
      return {
        commandNonce: s.commandNonce + 1,
        command: { kind: 'toggle', tab: s.command.tab },
        toggleNonce: s.toggleNonce + 1,
      };
    }),

  requestCollapse: () =>
    set((s) => {
      const now = Date.now();
      if (now - lastCollapseTs < THROTTLE_MS) return s;
      lastCollapseTs = now;
      return {
        commandNonce: s.commandNonce + 1,
        command: { kind: 'collapse', tab: s.command.tab },
      };
    }),
}));
