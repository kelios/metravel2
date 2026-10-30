---
name: metravel-travel-book-designer
description: "Design ready MeTravel photo diaries: compare illustration styles, prepare landmark artwork and physical page samples, and hand an approved visual system to PDF assembly."
---

# MeTravel Photo Diary Designer

Use for ready editorial photo diaries, not the personal-article export UI or
quest covers. `AGENTS.md` is inherited. Read the current decisions in
`docs/features/travel-memory-books.md` and the referenced selection/design files;
they own countries, author, place count and pages per place. Do not turn a
prototype's fixed page count into a reusable design constraint.

## Inputs and visual decisions

- Require concrete place IDs, the owning author's published travel URLs,
  verified map/place links, source photos, physical format and requested styles.
- Match the actual object, not merely its city or another landmark with a
  similar name. Keep ownership/provenance with each photo and derived artwork.
- Verify the selected published travel's author is `user_id=1` and the exact
  source photograph belongs to that same article. Record travel ID/URL, observed
  author ID, verification date, the image URI shown in the article and its
  original-file URI/hash. When the article uses a resized image, verify its
  association with the original in that article's media record; a matching
  filename, nearby point or another article by the same author is insufficient.
  Missing ownership or image association stops that sample for source
  clarification. Do not replace it with a third-party photograph.
- Use the supplied approval stage: when the owner requests style/layout
  agreement, show a representative sample before producing the full series.
  For a one-page approval request, make that one page first; do not expand it
  into every diary page or every style. That request does not authorize live
  article edits or publication.
- Preserve the specified content/photo/diary page roles. Keep an explicitly
  blank diary page free of decorative art, rules and writing prompts.
- Follow the approved page composition. The current collage direction blends
  the artwork into the paper rather than placing it inside a photo frame;
  do not add dashed borders or service headers. Keep provenance and AI-derivative
  disclosure in asset records and handoff; do not impose a printed credit/footer
  the owner removed. Retain any separately required third-party attribution.
- Choose licensed, embedded fonts with full Cyrillic coverage to match the
  artwork: an expressive calligraphic heading for watercolor, a distinct
  compatible heading for fantasy, and readable body type. Do not bake lettering
  into the generated illustration or make one sample's font a permanent rule.

## Make comparable variants

1. Choose one verified place and the same source photo/composition for the
   requested variants. Keep page geometry, copy and QR positions constant.
2. Read [style-prompts.md](references/style-prompts.md) for the required mode;
   it owns the reproducible graphic, watercolor, real-photo and fantasy prompts.
3. Use the built-in `imagegen` skill/tool for illustrative transformations;
   inspect local reference images first. The real-photo variant uses the
   author's original photo, not a generated approximation.
4. Keep architecture recognizable. Identify stylized/fantasy results as
   illustrations in provenance records and handoff rather than documentary
   evidence of the site's appearance; apply printed labels only when approved
   or required by the source license.
5. Generate artwork without letters, labels, logos or QR. Assemble typography,
   real QR links and print geometry deterministically using the `pdf` skill and
   the existing ready-book renderer; never trust an AI-drawn QR.
6. Save the exact prompt, reference URL/file hash, tool mode, output path and
   selected/rejected status. Use ignored staging for drafts; place only an
   approved production asset in its canonical asset directory.
   Record generated artwork as derived from the verified photo; it is never
   the author's original photograph, even when its composition is unchanged.
7. Use QR labels «Место на карте» and «Статья на сайте». Add «Квест» only when
   a real published quest is associated with this exact place: verify the route
   and matching step/place, then record its optional quest URL with the selected
   book place. A merely nearby city quest is insufficient; omit an unavailable
   quest without an empty slot or invented link.

## Inspect and hand off

- Render the requested PDF sample to images and inspect text, whitespace,
  artwork-to-paper edges, binding margin and QR geometry; inspect photo and
  diary pages when they are part of the requested sample.
  This is authoring inspection, not browser/device acceptance of app code.
- Compare variants side by side at the same scale. State whether the source
  photo's effective resolution supports the proposed printed size.
- Hand the builder the chosen style, exact files/hashes, provenance, geometry,
  typography, labels and approval evidence. A style sample is not a full book.
- Changes to skill/prompts require `npm run audit:prompts` and the skill
  validator. App code follows independent review and then the selected testing
  layer in `docs/TESTING.md` → `Validation selection gate`.

Report the samples inline, the local PDF/art files, exact prompt recipe and
which visual decision remains with the owner. Do not request approval again
for a stage already explicitly approved in the session.
