## Purpose

Measure which quests and destinations visitors seek in the quest catalogue, including searches that return no results, without recording unfinished typing as separate searches.

## ADDED Requirements

### Requirement: Measure settled catalogue searches

The web catalogue SHALL emit `quest_search` after a valid search query remains unchanged for 900 ms while the catalogue is focused and ready. The event MUST contain the lowercase trimmed `search_term`, the matching full-catalogue `results_count`, and `source=quest_catalog`.

#### Scenario: Successful search
- **WHEN** a visitor types ` Минск ` and leaves the query unchanged for 900 ms after its results become available
- **THEN** one event contains `search_term=минск` and the number of matching quests before pagination or sorting

#### Scenario: No results
- **WHEN** a settled valid query matches no quests
- **THEN** one event contains the query and `results_count=0`

#### Scenario: Typing and repeated rendering
- **WHEN** typing continues before 900 ms, or the same settled query rerenders because of sorting, view changes, or refreshed counts
- **THEN** unfinished queries and duplicate events for the same current search are not emitted

#### Scenario: Cleared and repeated query
- **WHEN** a visitor clears a previously tracked query and later enters it again
- **THEN** the new settled search can emit one new event

### Requirement: Preserve measurement boundaries

The system MUST suppress empty and one-character queries, queries over 100 characters, obvious email/URL/phone input, unfocused or unavailable catalogue states, and native provider events. Existing analytics consent and automation suppression MUST apply to delivery.

#### Scenario: Delayed or failed catalogue
- **WHEN** catalogue data is loading, failed, or still belongs to a previous input
- **THEN** no search event is emitted with stale results or an artificial zero

#### Scenario: Navigation cancels pending search
- **WHEN** the catalogue loses focus before the pending search is recorded
- **THEN** the pending event is cancelled

#### Scenario: Restricted delivery
- **WHEN** consent is denied, the page is automated, or the application is native
- **THEN** analytics providers receive no search event

#### Scenario: Non-search input
- **WHEN** the input is empty, one character, over 100 characters, or an obvious email/URL/phone value
- **THEN** no search event is emitted
