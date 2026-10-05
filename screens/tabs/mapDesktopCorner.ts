import { METRICS } from '@/constants/layout';

/**
 * #2220 — the top-left corner of the map in the desktop branch (width ≥ 768,
 * web, iPad and Android tablets). The panel's collapse chevron
 * (`map-panel-collapse-button`, `collapseToggleInPanel`) stands
 * `COLLAPSE_TOGGLE_OUTSET` past the panel's right edge and reaches across the
 * `MAP_PANEL_GAP` seam into the map. Whatever else lives in that corner — the
 * location-quality pill, the Leaflet control column — is placed from these
 * numbers, not from its own literals, so moving the chevron moves them too.
 */
export const MAP_PANEL_GAP = METRICS.spacing.m; // 16
export const COLLAPSE_TOGGLE_SIZE = 44;
export const COLLAPSE_TOGGLE_TOP = 16;
export const COLLAPSE_TOGGLE_OUTSET = 4;

/** How far the chevron reaches into the map, from the map's left edge (32). */
export const COLLAPSE_TOGGLE_MAP_INTRUSION =
  COLLAPSE_TOGGLE_OUTSET + COLLAPSE_TOGGLE_SIZE - MAP_PANEL_GAP;

/** Spacing between neighbours in the corner — the on-map cluster's gap. */
const MAP_CORNER_GAP = 8;

/** Left edge of an element sharing the chevron's band (40): right of the chevron. */
export const DESKTOP_MAP_CORNER_ROW_LEFT = COLLAPSE_TOGGLE_MAP_INTRUSION + MAP_CORNER_GAP;

/** Top of a left-edge column that has to pass under the chevron band (72). */
export const DESKTOP_MAP_LEFT_COLUMN_TOP = COLLAPSE_TOGGLE_TOP + COLLAPSE_TOGGLE_SIZE + 12;
