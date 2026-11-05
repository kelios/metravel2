## Purpose

Define how MeTravel produces and accepts acted animated episodes with recognizable characters, audible dialogue and a coherent sequence of actions.

## ADDED Requirements

### Requirement: Acted story before rendering

The production package SHALL define timed shots with observable action, character responses, dialogue, and the outcome of a choice. The protagonists SHALL each speak and respond within the same story. The package SHALL tie editorial facts and character likenesses to verified sources.

#### Scenario: Pilot storyboard is ready for a shot test

- **WHEN** the storyboard for «Кофе, потом гора» is reviewed
- **THEN** it specifies who speaks and when, what each participant does, and how selecting Leskowiec leads to reaching the summit
- **AND** its dialogue and shot timings fit the planned runtime

### Requirement: Evidence for a finished animation

A final episode SHALL contain purposeful subject motion, intelligible character dialogue, timed subtitles and a visible outcome. The production workflow SHALL distinguish a storyboard, an animatic and a finished episode. Rights, source evidence and explicit publication authority SHALL continue to apply.

#### Scenario: Static photo edit is rejected

- **WHEN** a 15-second export contains only panned or zoomed photographs and written captions
- **THEN** it fails animated episode acceptance even if its video format is valid

#### Scenario: Renderer or speech unavailable

- **WHEN** the chosen renderer or a permitted voice source is unavailable
- **THEN** the workflow reports the exact blocker and delivers a labeled draft with its shot and dialogue plan
- **AND** it does not mark the episode ready for publication

#### Scenario: Finished scene is reviewed

- **WHEN** a rendered episode is reviewed with sound and muted
- **THEN** the reviewer can identify the speakers, match their actions and responses across cuts, and follow the story with the subtitles
- **AND** the review records the result against the exact export
