## Purpose

Let quest players submit an unambiguous quantity as digits or cardinal words without accepting a different quantity or malformed numeric input.

## ADDED Requirements

### Requirement: Equivalent quantities are accepted

The system SHALL accept numeric literals and equivalent cardinal words from zero through 999 in RU/BE/UK/PL/EN for numeric quest answers. Larger numeric literals SHALL remain supported. Authored textual answer variants and free responses SHALL retain their existing behavior.

#### Scenario: Sofia tower count
- **WHEN** a player submits `2`, `два` or `две` for the two-tower count
- **THEN** the answer is accepted
- **AND** `3`, `три` and `второй` are rejected

#### Scenario: Current locales
- **WHEN** a player submits the valid local cardinal equivalent of two in RU, BE, UK, PL or EN for the two-tower count
- **THEN** the answer is accepted without changing the interface language

### Requirement: Numeric validation consumes the whole input

The system MUST reject malformed prefixes, non-finite numbers and fractional inputs for integer count patterns. Approximate numeric answers SHALL preserve their fractional tolerance contract. Number recognition MUST NOT equate ordinals with cardinal quantities or widen unrelated text answers.

#### Scenario: Prefix and fractional false positives
- **WHEN** a player submits `2abc`, `2.5`, `2,5` or `-2` for a count of exactly two
- **THEN** the answer is rejected

#### Scenario: Approximate fractional answer
- **WHEN** a complete decimal value falls within the configured approximate tolerance
- **THEN** the answer is accepted with a decimal comma or decimal point

#### Scenario: Floating-point rounding cannot change a count
- **WHEN** a player submits `2.0000000000000001` for a count of exactly two or an unsafe numeric literal
- **THEN** conversion does not silently turn the submission into an accepted integer or textual variant

### Requirement: Unanswered final points preserve incomplete progress

The system SHALL preserve existing progress and final-point completion rules. Parser changes MUST NOT complete a player's unanswered final point or rewrite their answer history.

#### Scenario: Polotsk final point unanswered
- **WHEN** the seven required tasks have answers and the final monastery point has no answer or official finish action
- **THEN** completion remains false
