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
  - Web only: band boundaries are mirrored in `constants/adventFacadeBannerSources.web.ts` (`ADVENT_FACADE_BANNER_SOURCES`); the native pair `constants/adventFacadeBannerSources.ts` ships no copies (the app already bundles the full facade); recut the bands and update both together if the window grid or the banner frame changes. `__tests__/advent/adventBannerFacadeSources.test.ts` fails when a phone crop no longer fits a band.
- `frost-1.webp`–`frost-4.webp`: the four original atlas quadrants, technically sliced and encoded at 400×400 with alpha retained. No repainting or new narrative content.
- Glass coordinates and number/button placement are defined by the approved facade contract, not inferred from image loading.
- The image pack is imported only by advent components. The global seasonal logo must not import this module.

## Traveller title postcards

Four portrait illustrations for the web share and download actions. Each is an original ImageGen background. The canvas renderer adds the localized title, subtitle and calendar address. The WebP exports in `public/assets/images/advent-titles/` are 1080 × 1350. Only the earned tier's image is loaded.

### departure

Portrait 4:5, full bleed original vintage European winter travel poster, matte gouache and silkscreen print, touchable ink grain, layered illustrated snow and cold blue shadows, evergreen and petrol teal, warm apricot and vermilion highlights. Upper 35% calm dark teal twilight sky with sparse stars for white text later; subject concentrated in lower half. Bottom corners deep shadows, no lettering, numbers, logos or borders. A small honey-lit wayside station by a snowy woodland town at dusk. One traveler in a red winter coat carrying an old suitcase sets out on a freshly snowy platform, warmly lit clockless station canopy, snowflakes, an intimate cinematic sense of setting out. View from slightly above, careful architecture and delicate pines.

### lanterns

Portrait 4:5, full bleed original vintage European winter travel poster, matte gouache and silkscreen print, touchable ink grain, layered illustrated snow and cold blue shadows, evergreen and petrol teal, warm apricot and vermilion highlights. Upper 35% calm dark teal twilight sky with sparse stars for white text later; subject concentrated in lower half. Bottom corners deep shadows, no lettering, numbers, logos or borders. An intimate curving cobblestone lane in an old central European hill town in snow. Tall ochre and muted coral gabled houses with amber windows, an arched stone gate halfway down, a tiny bundled pedestrian carrying a lantern, deep blue shadows, picturesque composition with a view beyond the arch.

### trail

Portrait 4:5, full bleed original vintage European winter travel poster, matte gouache and silkscreen print, touchable ink grain, layered illustrated snow and cold blue shadows, evergreen and petrol teal, warm apricot and vermilion highlights. Upper 35% calm dark teal twilight sky with sparse stars for white text later; subject concentrated in lower half. Bottom corners deep shadows, no lettering, numbers, logos or borders. A pair of tiny red-coated hikers follow an elegant S-shaped trail of fresh footprints through a white forest clearing toward serrated snowy mountain peaks at dawn, mature dark blue spruce framing the lower corners, soft peach alpenglow and delicate pale winter light. Strong travel-poster perspective and serene scale.

### rail

Vertical 4:5 full-bleed vintage illustrated winter railway travel poster, no lettering anywhere. Beautiful original European mid-century railway lithograph meets hand-painted gouache on fine matte paper. The upper third is a calm deep petroleum teal twilight sky, clear low-contrast negative space especially to the left for later typography. Below it a dramatic indigo Carpathian mountain ridge recedes in lilac and pale peach dusk light. In the middle-to-lower two thirds, a small elegant vermilion vintage passenger train with amber windows follows a wide sinuous curve on a snow-covered hillside above fir forests, crossing a short stone-arch viaduct, its headlamp gold against blue snow. A few precise golden lights in a tiny distant town. In the foreground delicate detailed spruce branches and crosshatched midnight shadows at the bottom and left. Luminous snow, layered silhouettes, visible ink grain, graceful graphic composition, carefully crafted collectible postcard. Rich warm/cool palette, sophisticated, atmospheric, distinctive. No border, no text, no numbers, no logos, no ornaments in the sky, no mockup.

## All advent share formats

Christmas and fortune share exports use two additional original illustrations in the same vintage gouache series. Each WebP is 1080 × 1350, generated with ImageGen and inspected before integration. All typography is rendered by the application.

### christmas

Original sophisticated vintage European winter travel postcard illustration, portrait 4:5, matte gouache with silkscreen print and fine visible ink grain. Consistent series with deep petroleum teal and midnight blue, blue white snow, warm apricot and vermilion, luminous honey gold windows. Graceful detailed composition, a calm dark teal upper 35 percent with very little detail for later white typography, richly illustrated landscape in bottom half. No lettering, no logos, no words, no borders, no mockups, no symbols in the sky. A glowing Christmas tree in a small snow-covered central European town square at blue hour. Beautiful ornate ochre and muted red historic gabled houses, tiny bundled people strolling and a few warm lamps along a curved snowy lane, subtle snowflakes, fir branches framing lower corners, intimate golden light against cool snow, hand crafted illustrated architecture, peaceful festive atmosphere.

### fortune

Original sophisticated vintage European winter travel postcard illustration, portrait 4:5, matte gouache with silkscreen print and fine visible ink grain. Consistent series with deep petroleum teal and midnight blue, blue white snow, warm apricot and vermilion, luminous honey gold windows. Graceful detailed composition, a calm dark teal upper 35 percent with very little detail for later white typography, richly illustrated landscape in bottom half. No lettering, no logos, no words, no borders, no mockups, no symbols in the sky. A tiny warmly illuminated woodland cabin with a steep snowy roof nestled beside a frozen stream. A curving footpath across a small timber footbridge leads from foreground through deep blue pines to the welcoming amber window. Above the forest a crescent moon and a few delicate stars, distant lavender snowy hills, peach glow on snowy spruce tips, a quiet hopeful winter night. Dominant scenery at bottom, plenty of calm teal upper sky.
