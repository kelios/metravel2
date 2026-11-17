## Purpose

Показать основные разделы сайта и вынести практические сведения из популярных статей в доступный HTML.

## ADDED Requirements

### Requirement: Public discovery index

MeTravel SHALL serve a UTF-8 Markdown index of canonical public hubs at `/llms.txt`.

#### Scenario: Load the public index

- **WHEN** a guest requests `/llms.txt` with GET or HEAD
- **THEN** the server responds with HTTP 200 and a plain-text content type without a redirect
- **AND** the GET body contains the site name and absolute links to the public hubs

### Requirement: Owner-approved article facts

MeTravel SHALL show a semantic table titled «Коротко» in each of the 20 selected articles after the owner approves its text.

#### Scenario: Read the approved facts

- **WHEN** a guest opens an approved article
- **THEN** the public HTML shows exactly one «Коротко» table containing facts from that article with their original qualifiers

#### Scenario: An article lacks a fact or approval

- **WHEN** a field has no source in the article or the draft lacks approval
- **THEN** the unsourced row or unapproved table stays unpublished
