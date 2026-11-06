## ADDED Requirements

### Requirement: Place discussion in the catalog

Catalog readers SHALL be able to open a discussion from a place card without a discussion request for each rendered card.

#### Scenario: Browse before opening

- **WHEN** the catalog opens or a related article is selected
- **THEN** no comments request is sent until the reader opens the place discussion

#### Scenario: One discussion across articles

- **WHEN** a reader switches related articles and opens comments again
- **THEN** the same place discussion appears regardless of the selected article

### Requirement: Safe place comments

The discussion SHALL support guest reads and authenticated plain-text creation and own-comment removal using existing report and block behavior.

#### Scenario: Guest opens comments

- **WHEN** a guest opens a public place discussion
- **THEN** they can read and paginate and are prompted to sign in to post

#### Scenario: Send fails temporarily

- **WHEN** a signed-in user submits valid text and the request fails
- **THEN** the draft is retained and the user can retry without a false success

#### Scenario: Moderate or remove a comment

- **WHEN** an author deletes their comment or a reader reports or blocks through existing controls
- **THEN** the place discussion reflects the resulting permitted view without changing rating or source selection

#### Scenario: A new comment is held for moderation

- **WHEN** the server accepts a comment for review before publication
- **THEN** the author sees that the comment is awaiting approval and the public discussion only displays server-visible comments
