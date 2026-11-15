## ADDED Requirements

### Requirement: Measure route search outcomes and result use
The web site SHALL identify the terminal result of a settled nonempty catalog text search and report at most one first route selection per recorded search. It SHALL omit the search phrase if it fails the shared analytics privacy filter.

#### Scenario: A visitor opens a result immediately
- **WHEN** a visitor opens a route from current, settled search results before the measurement timer fires
- **THEN** the site records the search and its result outcome before recording the first selection

#### Scenario: A search completes without usable results
- **WHEN** the visible search settles with zero results or a request error
- **THEN** those outcomes are distinguishable and neither records a result selection

### Requirement: Measure useful actions on travel pages
The web site SHALL report explicit jumps to the description, map or coordinates and taps on telephone links in published route descriptions with the travel identifier and action type.

#### Scenario: A visitor taps a phone link
- **WHEN** a visitor activates a telephone link in a public travel description
- **THEN** the site records the travel and the type of interaction without the phone number or link URL

### Requirement: Keep consent and historical contracts
New measurement SHALL use the existing web analytics transport. Existing search event names and counts SHALL retain their meaning, and native clients SHALL emit none of the new web events.

#### Scenario: Delivery is disabled
- **WHEN** analytics consent is denied or the client is automated
- **THEN** the analytics transport sends none of the new product events to providers
