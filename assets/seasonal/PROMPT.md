# Compact Christmas brand decorations

Owner-approved on 2026-11-02: retain the existing golden bird, add a small red cap above the eye/beak and a miniature lit tree. No scarf or red strip near the tail. See `docs/design/advent-2026-approved.md`.

Use case: the compact Christmas accessory around the existing golden brand bird.
Asset type: code-authored SVG construction with transparent PNG siblings for shared rendering.
Constraints: leave the bird face visible, keep the existing logo source and geometry, add no scarf or captions, and preserve seasonal off and print behavior.

These are code-authored decorative assets, not newly generated travel photographs. `christmas-hat.svg` is the approved simple cap construction. `christmas-tree.svg` reuses the existing Christmas tree SVG from the seasonal CSS. PNG siblings are deterministic raster exports for shared web/native rendering through the canonical image component.

## Exact construction brief

The checked-in SVG files are the reproducible source; this brief describes their code-authored construction, not an image-generation run.

```text
Retain the golden bird unchanged. Construct a small warm-red cap with a pale brim and pompom in christmas-hat.svg. Reuse the existing seasonal Christmas fir in christmas-tree.svg, keeping its green branches, snow, gold lights and red ornaments. Export transparent PNG siblings without changing either composition. Place the cap above the eye/beak and the miniature tree beside the logo. Add no scarf, tail strip, captions or interactive decoration.
```

Hat placement is proportional to the original bird frame (left 6%, top -22%, width 55%, height 36%), preserving its original image source, size and navigation. The tree sits beside the logo at compact header scale. Seasonal auto/off/manual behavior remains authoritative.
