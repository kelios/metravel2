---
name: metravel-instagram-visuals
description: "Audit, remake or generate MeTravel Instagram carousel imagery with verified city landmarks, quest scenes and truthful photo-to-caption matching. Use when pictures misrepresent a route or quest, or a consistent illustrated content pack is requested."
---

# Instagram Visuals

Work on the requested post's images. Use `$metravel-instagram-editor` for source
and account actions; visual generation itself does not publish or reschedule.
Read [references/visual-brief.md](references/visual-brief.md) when creating the
source manifest, prompts and final visual checks.

## Establish what each slide must show

Inspect the full current carousel, caption and relevant article/quest detail.
Check the catalog's age/family tags and the language and mechanics of the tasks
before choosing a visual age. A dragon or a fairy-tale theme does not make a
quest a children's quest. With no explicit age adaptation, use general-audience
travel art; do not add child tags to justify cute imagery. For a general-audience
myth quest prefer natural proportions, restrained motifs and an atmospheric
editorial palette; oversized eyes, baby proportions and toy-like clue objects
need an explicitly child-directed brief.
For each slide record its purpose, exact place/step, confirmed visible anchors,
source photo/reference, current mismatch and chosen medium. A dragon or a
castle alone does not identify a city quest. Prefer a recognizable real route
and the activity: walking, observing details, finding clues with a smartphone.

For a quest such as Minsk's Цмок, use only locations confirmed in its steps:
river/park/neighbourhood and landmark references, with a restrained river-dragon
motif where the story supports it. Reject generic medieval skylines, volcanic
fire, invented monuments and unrelated cities. Do not present generated maps
as usable navigation; any route map must use verified coordinates and order.

## Choose and generate

- Documentary photo: owner/site/licensed material, provenance and landmark
  verified. A generated or heavily composited scene is not a documentary photo.
- Illustration: explicit stylized campaign artwork, place anchors grounded in
  references, legend motif visually secondary. Mark it as an illustration in
  the working manifest and final handoff; use a discreet visible label when
  realistic styling might mislead. Do not change the approved caption merely
  to add disclosure without authorization.
- Use the built-in `image_gen` tool and its skill by default. Do not invoke
  legacy image CLI helpers or another provider unless the user chooses it.
  Inspect local references before editing; pass reference paths or the minimum
  recent-image context according to the tool contract. Preserve transparency
  for existing transparent artwork unless requested otherwise.
- Generate scene art separately from text/layout when lettering must be exact.
  Use the existing carousel builder for precise Russian typography, footer
  bird from `assets/images/icon.png`, `@metravelby`, pagination and legibility.
  Carry a shared style brief through every prompt: aspect, palette, season,
  lighting, landmark proportions and motif. Reuse existing approved slide text.

## Validate and deliver

Review every generated image visually before composing, then inspect every
final slide and a contact sheet. Check identifiable city anchors against
references, image/text correspondence, coherent story, mobile text contrast,
crop, numbering and footer. A fluent generated picture is not factual evidence.
Regenerate the failing scene when geography or a required detail is wrong;
do not hide the error under a title. Omit unverified architectural detail.

Final carousel target follows the existing post; normally JPEG/PNG 1080×1350
with identical dimensions and ordered filenames. Keep originals, prompts,
source manifest, final slides and preview in the editor's ignored output folder.
Return actual files and preview, verified places, and illustration provenance;
delegate authorized account save/verification to the editor workflow.
