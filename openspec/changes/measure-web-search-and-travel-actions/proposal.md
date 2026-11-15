## Why

The site records searches and some actions, but the report cannot distinguish a zero-result search, a request failure and a query that led to a route. A short article visit can also include a useful map jump or phone tap.

## What Changes

- Record result outcome on the existing settled route-catalog search and record the first route opened per measured search.
- Record explicit use of itinerary sections and phone links on public travel details.
- Reuse the existing consent-controlled GA4 and Metrika transport and document report setup and interpretation.

## Capabilities

### New Capabilities

- `web-search-and-travel-actions`: search outcome, result selection and travel detail actions.

### Modified Capabilities

None.

## Impact

Desktop and mobile web analytics, shared card and detail wiring, no localized copy or API changes. The existing quest funnel supplies quest-view, start and first-point evidence. Rollback is a frontend revert. Historical sessions keep their original payloads.
