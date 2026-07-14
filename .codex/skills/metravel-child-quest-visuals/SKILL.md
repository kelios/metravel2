---
name: metravel-child-quest-visuals
description: Create, replace, and validate age-appropriate illustrated covers and visual series for metravel children's, family, fairy-tale, park, and teen quests. Use for child quest cover prompts, watercolor or animated quest art, fantasy/adventure visuals, age-band style selection, or when an existing quest image looks like adult travel photography instead of a child experience.
---

# Metravel Child Quest Visuals

Create quest art that communicates a child's role, goal, and adventure before it communicates architecture or tourism.

## Read first

- `AGENTS.md`, `docs/RULES.md`, and `docs/ICON_ART_PROMPTS.md`.
- `constants/modernMattePalette.ts` for brand accents.
- `../metravel-quest-writer/references/child-quest-design.md` for age, story, safety, and language fit.
- The production quest bundle and neighboring child covers before replacing an existing image.
- The built-in `imagegen` skill completely before generation.

## Select one age mode

| Primary age | Visual mode | Required feeling | Avoid |
| --- | --- | --- | --- |
| 5–7 | soft watercolor storybook | one friendly helper, one clear goal object, gentle magic, simple silhouette | busy city panorama, scary stakes, tiny clues, realistic documentary photo |
| 8–10 | animated fairy-tale adventure | active mission, expressive original characters or enchanted city objects, readable clue trail | passive postcard, schoolbook diagram, franchise imitation |
| 11–14 | cinematic animated mystery or graphic-novel fantasy | agency, layered evidence, urban discovery, sophisticated light and composition | preschool mascots, babyish proportions, generic adult travel photography |

Do not average several bands into one style. When the product has separate child and teen quests, build two related visual families rather than one compromise.

## Visual contract

- Make the quest premise visible: show who needs help, what was lost or changed, and what kind of clue the player will follow.
- Anchor fantasy in a recognizable route setting, but do not invent readable signs, monuments, murals, or historical claims.
- Prefer watercolor, gouache, painterly animation, storybook fantasy, or an age-appropriate graphic-novel look. Quest covers may be illustrated; travel/article photo rules remain unchanged.
- Use the MeTravel warm-orange accent `#f5842c`, cream `#fff8f3`, muted sage `#7a9d8f`, and blue-grey `#8a9aa8` without turning the scene neon.
- Keep the focal character or clue inside the central safe area. Default quest cover output is landscape 16:9, final `1672x941` PNG or WEBP.
- Keep space and contrast for the card's title overlay. Do not bake title copy into the image.
- Use only original characters. Never imitate protected book, film, game, toy, or cartoon identities.
- No generated text, letters, numbers, logos, watermarks, fake URLs, horror, weapons-as-play, unsafe child behaviour, or identifiable real children.
- Do not make material or architectural terminology the visual hook. A child follows a sleeping lion, runaway ball, lost song, escaped drawing, secret symbol, or magical map—not “bronze”, “facade”, or “architectural layer”.

## Workflow

1. Read the quest title, primary age, role, goal, stakes, midpoint turn, finale, and route landmarks.
2. Reduce the cover to one sentence: `<child role> helps <character/object> achieve <goal> by following <clue type>`.
3. Choose the age mode and one recurring visual grammar for the whole series.
4. Build a prompt with: use case, quest premise, original subject, real route anchor, age mode, 16:9 composition, MeTravel palette, central safe area, and negative constraints.
5. Generate with the built-in `image_gen` tool. Use one call per distinct cover.
6. Inspect the full image and final crop. Reject adult postcard photography, illegible micro-detail, accidental text, extra limbs, copied characters, frightening expressions, or a scene that does not reveal the quest premise.
7. Save the selected raster in `assets/quests/<questAssetDir>/cover.png` and store the exact prompt in the neighboring `PROMPT.md`.
8. Treat upload and publication as separate actions. Replace production media only after explicit user authorization, save a rollback/catalog snapshot, update only the intended quest IDs, then re-fetch every `cover_url`.
9. Verify the catalog card and representative detail pages in a real browser; check screenshots, console errors, and failed media requests.

## Prompt skeleton

```text
Use case: illustration-story
Asset type: 16:9 MeTravel quest cover for ages <band>
Quest premise: <role, helper, goal, stakes, clue>
Scene: <recognizable route anchor transformed through gentle fantasy>
Subject: <one original focal character or enchanted object in action>
Style: <selected age mode>, warm hand-painted texture, polished animation background
Composition: landscape 16:9, central-safe focal action, clear depth, title-overlay contrast
Palette: warm orange #f5842c, cream #fff8f3, muted sage #7a9d8f, blue-grey #8a9aa8
Constraints: original characters, child-safe action, story readable without text
Avoid: text, letters, numbers, logo, watermark, photorealistic travel postcard, copied franchise, horror, clutter
```

## Validation

- State the selected age band and visual mode.
- Compare the series side by side for palette, character scale, line/paint treatment, lighting, and clue readability.
- Run `npm run check:image-architecture`, `npm run audit:prompts`, and the skill validator when skill or prompt files changed.
- Return `PASS`, `FIXED`, `FAIL`, or `VERIFY_PENDING` for the production browser pass.
