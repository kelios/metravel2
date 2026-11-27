# Local quest-cover draft for the supervision guide

Use: internal reference for supervised cover generation, not a replacement for
any published quest image or a verified reconstruction of Polotsk architecture.
The owner requested a real local cover-generation trial on 2026-11-27.

Caller: Gemma 4 12B QAT through the bounded student profile, thinking enabled.
Generator: local FLUX.2-klein-4B Q4 / MFLUX, 4 steps, seed 42, 768×512 PNG.
Measured generator time: 9.7 seconds; LLM planning/reload is additional time.
Output: `quest-cover-draft.png`; physical PNG header confirms 768×512 (3:2).

## Exact generated English prompt

```text
A warm, hand-drawn animation style illustration for children aged 8-10. A small child explorer is in a cozy, safe pedestrian square, reaching out a hand towards a floating, glowing golden crescent-shaped handle. Next to the child is a kind, large magic book. In the background, a stylized allegory of a city square with light-colored facades and a bronze statue of a person with a book on a granite pedestal. Color palette: cream (#fff8f3), warm orange (#f5842c), sage (#7a9d8f), and blue-gray (#8a9aa8). Soft daylight. No text, no letters, no numbers, no logos, no watermarks. The central hero and the magic book are in the center with calm space around them.
```

## Teacher acceptance

Accepted as an instructional draft showing the actual local pipeline and its
limits. The child reaching for a glowing arc, the book, warm palette and safe
square are legible. There is no readable title, logo or watermark. The figure
looks younger than the requested 8–10 band; the book ornament has decorative
marks that need human inspection. The prompt's “handle” is an imprecise rendering
of a lost arc/breve and should become “floating golden arc fragment” in a future
production brief. Architecture is generic stylization, not evidence of a real
landmark's shape.

This is **not an accepted production cover**: a child-quest master requires
1536×1024 and the correct age/style and landmark review. Do not upscale this
sample and call it a compliant master; do not publish it over a healthy cover.
All existing catalog quests had `cover_url`, so no production replacement was
needed or performed. Preserve the draft as a useful positive/negative reference.
