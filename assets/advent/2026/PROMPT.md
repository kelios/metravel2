# Winter apartment-house advent artwork

Approved by the owner on 2026-11-02 in the design chat; implementation requested explicitly afterwards. Full design/acceptance contract: `docs/design/advent-2026-approved.md`.

Use case: the approved 24-window winter advent facade and its unopened-window frost layers.
Asset type: one 2:3 raster illustration and four transparent raster frost textures.
Constraints: retain the approved composition, no visible captions or numbers in the art, no documentary-location claim, and no new generation during implementation.

## Source and mode

Built-in `image_gen`, not a photograph or an illustration of a specific real building. Canonical production files are the WebP assets in this directory. The original PNGs and full prompt JSON are retained with the owner's approved prototype; these compressed copies preserve the approved composition.

## Facade prompt

```text
An adult, cosy gouache winter-postcard illustration: view from a snowy street onto the flat facade of a late-Soviet panel apartment building. Exactly four equally spaced columns of rectangular windows on six floors, 24 apartments total. Warm amber interiors show small natural silhouettes decorating Christmas trees, baking gingerbread, wrapping gifts, reading together, preparing a table or planning a winter journey. Some windows contain a cat, dog or bird. Grey-beige concrete panels and regular seams, white window frames, snow on sills/cornices, a snowy bench and little outdoor fir at the bottom, minimal sky. Front-on composition, no perspective tilt, no captions, numbers, watermark, village cottages, fantasy castles or large cartoon faces. Portrait 2:3. All windows lit in the source; the application controls per-window glaze/frost from actual progress.
```

## Frost prompt

```text
One transparent texture atlas, exactly 2×2 equal square cells, edge to edge. Four different delicate milky-white/silver-blue natural frost patterns: fern-like crystals growing from corners, feathered side edges and a few small snowflake crystals. Most of each centre stays transparent so dim warm light and silhouettes remain visible. Softly painted winter-postcard style, no opaque background, frame, house, people, text or numbers.
```

## Technical preparation

- `winter-house.webp`: approved 900×1350 facade, approximately 239 KB.
- Banner derivatives (#3488), cut from `winter-house.webp` with `cwebp -m 6`, no repainting. The home banner crops a window of the facade and must not download the full 239 KB file:
  - `winter-house-small.webp`: the whole facade at 480×720, `-q 70` (~52 KB), for the 120 px desktop window.
  - `winter-house-row-1.webp`…`winter-house-row-6.webp`: full-resolution 900 px bands around each window row, `-q 75` (23–31 KB), for the full-width phone crop. Source pixel rows: 50–266, 229–446, 414–630, 595–811, 780–996, 964–1180.
  - `winter-house-roof.webp`: rows 0–445 at full resolution, `-q 75` (~54 KB), the roof crop of the announce.
  - Band boundaries are mirrored in `constants/adventVisuals.ts` (`ADVENT_FACADE_BANNER_SOURCES`); recut the bands and update both together if the window grid or the banner frame changes. `__tests__/advent/adventBannerFacadeSources.test.ts` fails when a phone crop no longer fits a band.
- `frost-1.webp`–`frost-4.webp`: the four original atlas quadrants, technically sliced and encoded at 400×400 with alpha retained. No repainting or new narrative content.
- Glass coordinates and number/button placement are defined by the approved facade contract, not inferred from image loading.
- The image pack is imported only by advent components. The global seasonal logo must not import this module.
