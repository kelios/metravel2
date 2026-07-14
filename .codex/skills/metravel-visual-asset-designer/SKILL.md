---
name: metravel-visual-asset-designer
description: Specify, generate, post-process, integrate, and verify branded raster icons, badge art, app icons, empty-state art, and marketing assets for metravel. Use when Codex is asked to generate an icon, badge image, app-icon set, quest/article art, or a coherent visual asset series. Use the image generation skill/tool for new raster output and preserve project restrictions for published travel/article media.
---

# Metravel Visual Asset Designer

Read `AGENTS.md`, `docs/RULES.md`, `docs/ICON_ART_PROMPTS.md`, `constants/modernMattePalette.ts`, and neighboring assets before generating.

For children's, family, fairy-tale, park, or teen quest covers, also use `$metravel-child-quest-visuals`; it owns age-band selection and the illustrated story contract.

## Decide the Asset Class

- Prefer Feather or an existing vector/component for a simple monochrome UI glyph.
- Use raster generation for multicolor, dimensional, illustrative, badge, app-icon, or marketing art.
- Published travel/article covers, galleries, description images, and map-point photos must be real, licensed/local, or photorealistic generated raster media. Quest covers may use the illustrated style explicitly selected by `$metravel-child-quest-visuals`. Do not substitute icon art, screenshots, or placeholders.

## Workflow

1. Define slot, subject, aspect ratio, output sizes, alpha/background needs, light/dark variants, and integration point.
2. Search existing assets first; do not create near-duplicates.
3. Build the prompt from `docs/ICON_ART_PROMPTS.md`: one base style, one preset, project palette, concrete subject, framing, and negative constraints. Keep one coherent style across a set.
4. Use the `imagegen` skill/tool for generation. For edits, inspect the source image first and include it in the edit request.
5. Save the resulting raster locally before integration. Keep temporary generations in an ignored folder; move only approved production assets to the neighboring canonical asset directory.
6. Do not edit `app.json` icon/splash paths unless the user explicitly requested that config change.
7. Integrate through existing project image primitives. Validate alpha edges, small/large rendering, light/dark surfaces, bundle paths, and the changed UI in a browser/device as appropriate.

## Validation

- Run `npm run check:image-architecture` and the narrow changed-scope checks when code or asset wiring changed.
- For a series, compare palette, lighting, stroke/volume, framing, and subject scale side by side.
- Do not ship generated text, watermarks, fake URLs, or an uninspected image.

## Handoff

Report asset purpose, prompt/preset, generated files and sizes, integration point, validation, and any blocked config/upload step.
