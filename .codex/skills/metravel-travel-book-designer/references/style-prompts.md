# Photo diary style recipes

Use only the variants requested by the owner. Fill the input fields from the
verified source record before generation and save the fully expanded prompt
with the output. One input photograph keeps the same landmark, viewpoint and
subject scale across a comparison; it is an identity reference, not permission
to invent architectural details. Respect the requested proof size: a one-page
approval sample does not trigger a full three-page block or a four-style set.

## Shared input and constraints

Required input: `place_name`, `source_photo_file`, `source_photo_sha256`,
`source_photo_url`, `article_image_uri`, `travel_id`, `travel_url`,
`verified_author_id=1`, `source_verified_at`, `output_aspect_ratio`,
`printed_image_mm`, `heading_font_file`, `body_font_file`, `font_licenses`,
`heading_treatment`, `body_treatment`. Keep the evidence that the exact article image resolves to
this original photograph in the same travel record; do not infer that connection
from a similar landmark, filename or a photograph in another travel.

```text
Use case: style-transfer
Asset type: artwork for a printable MeTravel photo diary
Input image: the author's verified photograph of {place_name}, identity reference
Primary request: reinterpret this exact view in the selected visual style
Composition: retain recognizable building geometry, viewpoint and subject scale;
output aspect ratio {output_aspect_ratio}, no cropping of important architecture;
an integrated collage with artwork edges dissolving into the light paper,
not a rectangular framed photograph
Constraints: the real place must remain identifiable; no invented towers or
facades, no readable text, labels, letters, logo, watermark, border, dashed frame,
service header or QR code
```

Apply one illustrative preset below to this base. Do not concatenate all styles.
Reference and transformation permissions remain attached to the resulting asset.

## 1. Black-and-white graphic illustration

```text
Style/medium: fine black ink architectural drawing on clean white paper,
confident contours and restrained cross-hatching, elegant travel sketchbook
Palette: black and white only, no color wash or grey photographic background
Detail: preserve the photographed landmark's proportions and identifying details;
use controlled line density so small printed details remain legible
```

## 2. Watercolor

```text
Style/medium: hand-painted transparent watercolor with subtle pencil structure,
soft pigment edges and generous light paper areas, adult travel journal
Palette: derive muted natural colors from the source photograph
Detail: preserve the real landmark's proportions and recognizable architecture;
avoid sugary cartoon treatment, heavy texture and invented decorative buildings
```

Page typography: choose an artistic, Cyrillic-capable calligraphic heading and
a restrained readable body face. Verify the selected font files and licenses;
the current sample's choices do not prescribe fonts for every future style.

## 3. Real author photograph — no image generation

Use `source_photo_file` unchanged as the documentary image. Lay it out at the
same position and scale as the illustrations. Preserve its original composition;
do not synthesize missing pixels, replace weather or pass a generated photo as
the author's image. Keep capture/provenance information. Report effective ppi
for `printed_image_mm`; layout approval does not prove print resolution.
For an approved collage composition, retain the unmodified source file and use
non-destructive page compositing to soften its outer edge into the paper;
do not rewrite the photographed content or add a frame.

## 4. Fantasy illustration

```text
Style/medium: atmospheric painterly fantasy travel illustration, imaginative
light and subtle magical atmosphere, a beautiful place to discover
Subject: the same recognizable {place_name}, with its real silhouette and
architecture intact; fantasy belongs to atmosphere rather than invented history
Palette: harmonious colors anchored in the reference photograph
Avoid: extra towers, fake historical events, readable runes/text, copied franchise
characters, frightening imagery and visual clutter
```

Page typography: choose a distinct Cyrillic heading that belongs to this fantasy
direction, with readable body text. Render it as embedded PDF text, not letters
inside the generated picture.

Record this variant as an illustration and retain its AI-derivative provenance
in metadata/handoff. Do not impose a printed credit such as
«MeTravel · акварель по авторскому фото» when the owner removed it. Source-license
attribution, when required, remains a separate requirement. The artist does not
bake credits or QR into the artwork.

## Deterministic page assembly prompt

```text
Build only the requested approval page using the approved physical format and
current page-role contract from docs/features/travel-memory-books.md. Compose a
single integrated collage whose illustration dissolves into the paper, without
photo frames, dashed borders or service headers. Render style-adaptive Cyrillic
typography with the verified licensed font files as real embedded text. Add two
real vector QR codes labelled «Место на карте» and «Статья на сайте» from the
verified targets. Add a third code labelled «Квест» only after verifying a real
published quest route and a step associated with this exact place; otherwise
omit it entirely. Keep optional quest URL and association evidence in the book
place record. Do not print an owner-removed footer/credit; keep provenance in
asset records and handoff. When separately requested, produce the personal-photo
page at its declared millimeter size and keep the diary page blank. Render the
actual PDF and return the preview/PDF for approval, not publication.
```
