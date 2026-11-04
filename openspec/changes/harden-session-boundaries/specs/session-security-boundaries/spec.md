## ADDED Requirements

### Requirement: Revoked native session credentials stay unavailable

The app MUST suppress reads of a revoked native token until a replacement is securely stored.

#### Scenario: SecureStore refuses to delete an access token

- **WHEN** the app revokes the token and SecureStore rejects deletion
- **THEN** subsequent requests and a restarted app do not read the old token if the revocation marker persisted

### Requirement: Web logout reflects server acknowledgement

The web app MUST retain the authenticated UI when the server fails to confirm logout.

#### Scenario: Logout fails and the user retries

- **WHEN** the logout request fails
- **THEN** the app reports failure and preserves the current identity
- **AND** a subsequent successful attempt clears the local identity

#### Scenario: Two logout actions overlap

- **WHEN** a second logout begins while logout is pending
- **THEN** both callers receive the result of a single request

### Requirement: Activating a linked account requires user intent

The app MUST receive an explicit action for the current activation link before requesting account activation or installing its session.

#### Scenario: A signed-in visitor opens an activation link

- **WHEN** the visitor opens a link containing an activation hash
- **THEN** the current session is preserved and the app explains that confirmation signs into the account linked to the hash
- **AND** the visible URL no longer contains the hash
