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

  /**
   * Monotonic counter bumped when the user opens the sheet via the "Искать
   * места" search row. The place-name search input watches it to grab focus
   * (open the keyboard) immediately, so search is a single tap, not two.
   */
  searchFocusNonce: number;

  /**
   * Latched intent: true between the moment the user taps the search row and
   * the moment the search input actually grabs focus. Unlike the nonce, this
   * survives the input being mounted fresh (sheet switching list→filters mounts
   * MapSearchInput AFTER the nonce already bumped), so the input can detect a
   * pending focus request on its very first mount and open the keyboard. The
   * input clears it via `consumeSearchFocus` once it has focused.
   */
  pendingSearchFocus: boolean;

  /**
   * Monotonic counter bumped when the user taps the "Слои" icon in the top
   * overlay. The "Слои и настройки карты" CollapsibleSection inside the filters
   * sheet watches it to auto-expand and reveal the map layers controls.
   */
  layersOpenNonce: number;

  /**
   * Latched intent mirroring `pendingSearchFocus`: true between the tap on the
   * "Слои" icon and the moment the layers section mounts + opens. Survives the
   * filters body being mounted fresh (sheet switching list→filters mounts it
   * AFTER the nonce already bumped), so the section can detect a pending request
   * on its first mount. Cleared via `consumeLayersOpen`.
   */
  pendingLayersOpen: boolean;

  /** Open the panel to the given tab (default: filters). */
  requestOpen: (tab?: MapPanelRequestedTab) => void;
  /** Toggle the mobile sheet open/collapsed. */
  requestToggle: () => void;
  /** Force-collapse the mobile sheet. */
  requestCollapse: () => void;
  /** Ask the place-name search input to focus (open keyboard). */
  requestSearchFocus: () => void;
  /** Clear the latched focus intent after the input has grabbed focus. */
  consumeSearchFocus: () => void;
  /** Ask the filters sheet to expand the "Слои и настройки карты" section. */
  requestLayersOpen: () => void;
  /** Clear the latched layers-open intent after the section has expanded. */
  consumeLayersOpen: () => void;

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
  searchFocusNonce: 0,
  pendingSearchFocus: false,
  layersOpenNonce: 0,
  pendingLayersOpen: false,

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

  requestSearchFocus: () =>
    set((s) => ({
      searchFocusNonce: s.searchFocusNonce + 1,
      pendingSearchFocus: true,
    })),

  consumeSearchFocus: () =>
    set((s) => (s.pendingSearchFocus ? { pendingSearchFocus: false } : s)),

  requestLayersOpen: () =>
    set((s) => ({
      layersOpenNonce: s.layersOpenNonce + 1,
      pendingLayersOpen: true,
    })),

  consumeLayersOpen: () =>
    set((s) => (s.pendingLayersOpen ? { pendingLayersOpen: false } : s)),
}));
