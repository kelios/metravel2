## Context

Board #3036–#3041 share the ready-books feature, its immutable file storage and its catalogue. Current country editions have four styles each and depend on the 30+ places contract.

## Goals / Non-Goals

Deliver the discovery, download and pilot behaviors described in the spec. Keep full editions, native availability, print status and backend outside the data migration.

## Decisions

1. Keep country grouping in the catalogue using the existing edition-family key. Preserve topic filtering and links into each style. Shorten the mobile hero visually and move the chooser above the explainer. Reuse the existing guest menu or header ordering for access at 1280.
2. Derive body and cover links from the selected profile and existing artifact kinds. Show purpose at the action and preserve browser downloads. Existing articles use the verified related index and consent-aware events.
3. Record asset rights from their canonical class records and bind exact revision evidence to new publication. Audit unresolved or unsupported legacy records explicitly. Keep publication blocking separate from pure read-only inventory.
4. Use a separate compact metadata record for pilots and the same immutable storage verification. Each pilot has one A5 PDF, one sample image generated from the PDF and a rights proof. Keep staged resources out of the catalogue until the owner terminal uploads them and public verification succeeds. This avoids relaxing or emulating a full-edition manifest record.
5. For the redesigned pilots, lead with place imagery whose rights and exact source are verified. The preparation page lets readers pick one trip. Each trip page separates the observation prompt, access information and navigation from the space reserved for the reader's memory. Review every page of the revision at reading and print scale. Fit the portrait cover in the catalogue thumbnail without distorting it.

6. Give short diaries their own catalogue section and a complete one-outing flow (#3069). Keep website discovery themes in a lightweight index, independently of immutable PDF editions. Show all six page roles, each trip's exact map/source and PDF page, an explicitly numbered sample, full-PDF reading and instructions for printing one A5 page. Preserve all existing edition bytes and editorial text.

## Risks / Trade-offs

Grouping can hide links if implemented as dynamic-only state. Render real anchor links for every style. Files must stay visible according to the selected profile. A request event alone cannot prove delivery. Historical asset provenance may be incomplete and is reported separately. S3 upload is owner-operated.

## Migration Plan

Deploy reversible catalogue/download/discovery changes with the existing public manifest. Stage pilots locally, verify the same bytes before and after the owner upload, then activate and deploy via the ordinary versioned manifest flow. Roll back by withdrawing only the pilot entry or reverting the web commit.
