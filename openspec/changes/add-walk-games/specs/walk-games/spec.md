## ADDED Requirements

### Requirement: Public walk game catalog

The website SHALL offer a kids' deck and an adults' deck for two participants, with online and print entry points for each deck.

#### Scenario: A guest opens Games and quizzes

- **WHEN** a guest opens the section from navigation or its public URL
- **THEN** both decks and their two play formats are available without login

### Requirement: Online walk round

The online game SHALL present shuffled regular cards individually with an option to complete, skip, or go to the finale. Skipping SHALL leave the completed count unchanged.

#### Scenario: Players finish the walk

- **WHEN** players meet the deck goal, run out of cards, or choose to finish early
- **THEN** they see the deck's finale and can return or start a fresh round

### Requirement: Printable deck

Each deck SHALL offer a Russian A4 PDF with its rules, twelve cards and cutting guides.

#### Scenario: A visitor chooses print

- **WHEN** a visitor selects the PDF action for either edition
- **THEN** the matching print deck downloads

### Requirement: Printable coloring sheets from MeTravel photographs

The website SHALL offer an A4 coloring collection derived from verified author photographs and show relevant individual sheets on their source travel articles.

#### Scenario: A reader sees coloring sheets for the route

- **WHEN** a reader opens an article with a published sheet
- **THEN** the principal place of the article is shown without people, with a preview and an individual A4 PDF action

#### Scenario: A family prepares for a trip

- **WHEN** a visitor downloads the coloring collection from Games and quizzes
- **THEN** one PDF contains all of the individual sheets and each illustration fits on its own A4 page


### Requirement: Thematic travel quizzes

The catalog SHALL offer quizzes about Belarus, Poland and the world, one question at a time, with feedback and a final result.

#### Scenario: Players answer a road-trip question

- **WHEN** players choose an answer
- **THEN** the result is recorded once and the explanation is shown before the next question

### Requirement: Optional route tasks

Associated articles SHALL offer optional observation tasks tied to published route stops.

#### Scenario: A walker skips a stop

- **WHEN** the walker skips a task or visits another stop first
- **THEN** other tasks remain available without location or answer validation

### Requirement: S3 publication

Published game data, printable files and previews SHALL be backed by S3 and excluded from persistent VPS and frontend release file storage.

#### Scenario: A revised edition is released

- **WHEN** the new edition is activated
- **THEN** the current manifest references the new verified immutable files and missing media is reported as unavailable
