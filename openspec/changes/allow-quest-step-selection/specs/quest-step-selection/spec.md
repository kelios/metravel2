## Purpose

Игрок может проходить точки квеста в порядке, удобном для прогулки, и возвращаться к оставленным заданиям.

## ADDED Requirements

### Requirement: Direct quest step selection

The quest wizard SHALL open any selected route point from its desktop or mobile route navigation. Existing guest access limits SHALL apply after selecting the point.

#### Scenario: Jump ahead and return

- **GIVEN** the first of three required points is current and none is answered
- **WHEN** the player chooses the third point in the sidebar or in the mobile route list
- **THEN** the third point becomes current, the mobile list closes, and both earlier points are shown as postponed
- **AND** the task count and the requirements for completion stay the same
- **AND** choosing the second point opens its unanswered task

#### Scenario: Resume an out-of-order route

- **WHEN** a player jumps ahead and reopens the quest after progress is saved
- **THEN** the selected point and the postponed points are restored with the existing answers

#### Scenario: Select another point at the guest limit

- **GIVEN** a guest has answered the free allowance of required tasks
- **WHEN** the guest selects another unanswered point
- **THEN** the sign-in prompt appears for that point
- **AND** the guest can still revisit the start card and answered points
