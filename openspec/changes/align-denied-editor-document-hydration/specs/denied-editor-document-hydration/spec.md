## Purpose

Keep intentional private-editor denial documents consistent with the first client render, while preserving access policy, ordinary navigation and private-data protection.

## ADDED Requirements

### Requirement: Denied editor document hydrates as the delivered NotFound page
The application SHALL render the same initial page tree and chrome as a delivered intentional404 document at a numeric editor URL, without changing that URL or suppressing hydration errors.

#### Scenario: Nonmanager cold and warm direct entry
- **WHEN** another author or guest directly opens or reloads a private numeric editor URL at desktop or mobile width, with either cold or warm cached scripts
- **THEN** document and API remain404, the NotFound page hydrates without React errors, editor/header/private decision/reason/date are absent, and navigation makes no writes or extra history transitions

### Requirement: Delivered denial does not become an editor after initialization
The application MUST retain the delivered denial until navigation away and MUST discard the bootstrap override after that departure.

#### Scenario: Auth settles and user navigates away
- **WHEN** authentication readiness changes after a delivered404, then the user uses Home or Back and later revisits through ordinary SPA navigation
- **THEN** readiness alone never mounts the editor, navigation works in the existing document, and the old bootstrap hint does not override the later route

### Requirement: Denial rendering preserves full routing registration and cold boot
The application SHALL preserve the original SceneView and nested navigation registration without mounting editor/header UI. Canonical NotFound documents SHALL load the authoritative Tabs layout and its dependency closure as classic defer scripts before entry.

#### Scenario: Cold denied document has an otherwise unresolved Tabs layout
- **WHEN** the ordinary Tabs layout chunk is absent from the browser cache
- **THEN** document boot waits for that authoritative layout and dependencies before entry, the requested numeric pathname/query/hash and history length remain intact, and Home/Back and hidden-screen state continue to work

### Requirement: Existing access and ordinary routes remain intact
The application SHALL preserve viewer-aware document status/cache/robots and existing editor, localized quest and NotFound behavior.

#### Scenario: Owner administrator and public controls
- **WHEN** owner or administrator opens the same private object, a nonmanager opens a public editor URL, or a user opens unknown numeric, new editor, ordinary NotFound or supported localized quest routes
- **THEN** owner/admin retain editor200/no-store/noindex, public retains canonical301, unknown retains private/no-store404, and ordinary routes render their existing content and navigation without new errors or permission expansion
