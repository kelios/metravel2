## Purpose

Make the existing quest map discoverable from the main map without duplicating quest data, markers or map engines.

## ADDED Requirements

### Requirement: Reach the quest map from map discovery

The main map's shared radius discovery panel SHALL expose a labelled internal link to `/quests/map`, accessible by touch and keyboard. The entry MUST preserve the existing quest-map destination behavior and MUST NOT imply that it is centered on the currently searched city.

#### Scenario: Open quests from the main map

- **WHEN** a visitor opens the radius discovery panel and activates «Квесты на карте»
- **THEN** the existing `/quests/map` screen opens with its existing quest catalog and viewport behavior.

#### Scenario: Use another production locale

- **WHEN** the interface uses RU, BE, UK, PL or EN
- **THEN** the entry has a localized visible label and link semantics with the same destination.
