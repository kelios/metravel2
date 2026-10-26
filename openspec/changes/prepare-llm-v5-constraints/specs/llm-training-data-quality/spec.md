# Spec Delta

## Purpose

Prepare reproducible assistant training candidates while protecting independent evaluation and preserving the facts and target needed to learn constraint handling.

## ADDED Requirements

### Requirement: Evaluation isolation
Training preparation SHALL protect all registered evaluation questions and the identifiers/names of controlled synthetic evaluation fixtures. It SHALL reject normalized question overlap and controlled fixture reuse, and construct new scenarios independently of held-out questions, paraphrases, schedules and reference answers. Real corpus facts and URLs remain eligible context. Exclusion inputs SHALL be recorded with the candidate.

#### Scenario: Question from any current evaluation set is submitted
- **GIVEN** the original, quality and complex evaluation sets are registered
- **WHEN** a candidate includes a held-out question with changed case, spacing or punctuation
- **THEN** preparation rejects that example and records its exclusion reason

#### Scenario: A new question refers to a held-out controlled venue
- **WHEN** a candidate uses a controlled synthetic evaluation fixture identifier or name under a different question
- **THEN** preparation rejects it rather than leaking the held-out scenario through another wording

#### Scenario: Replay uses an existing real article or quest
- **WHEN** replay uses real corpus facts or a real source URL also present in an evaluation
- **THEN** those facts or the URL alone do not cause rejection, while evaluation questions, paraphrases and references remain protected

#### Scenario: Evaluation protection input is missing
- **WHEN** a required evaluation input cannot be read or is malformed
- **THEN** preparation fails before producing an eligible training candidate

### Requirement: Independently grounded constraint examples
The candidate SHALL include 400–600 new fictional training examples with verified targets for joint constraints, infeasible choices, missing information and contextual follow-ups; the initial target is 120 independent scenarios with four phrasing variants each. All variants of a scenario SHALL stay within one split. A claim about access, independence or opening availability MUST be supported by supplied facts.

#### Scenario: A distractor fails one of three conditions
- **GIVEN** one supplied option meets all requested conditions and another fails one
- **WHEN** a supervised selection example is produced
- **THEN** its target selects the fully matching option and does not describe the distractor as suitable

#### Scenario: No option fits or access details are unknown
- **WHEN** no supplied option fits the time/access constraints or required access parameters are absent
- **THEN** the target identifies the specific conflict or missing information without inventing access or refusing the travel topic

#### Scenario: The user asks about a prior option
- **WHEN** a supervised follow-up refers to an earlier option
- **THEN** the supplied history identifies it and the target answers that option rather than restarting an unrelated list

### Requirement: Exact complete-example budget
Every prepared example SHALL be counted with the candidate's actual tokenizer and full training conversation template, including the assistant target. Its total SHALL not exceed 1024 tokens. Overlength examples SHALL be rejected as complete examples; facts, history and target MUST NOT be silently truncated to pass the budget.

#### Scenario: Characters fit but complete tokens exceed the limit
- **WHEN** an example estimated to fit by characters is actually 1100 tokens
- **THEN** it is excluded from the prepared candidate and reported as overlength

#### Scenario: A complete example is within the limit
- **WHEN** the exact encoded conversation is at most 1024 tokens and has a nonempty supervised target
- **THEN** the complete original conversation is preserved byte-for-byte in the eligible split

#### Scenario: Tokenizer is unavailable
- **WHEN** exact encoding cannot be performed
- **THEN** preparation fails rather than substituting an approximate budget

### Requirement: Auditable prepared candidate
Preparation SHALL be deterministic for fixed inputs and seed, retain split isolation, and record input/tokenizer identities, hashes, accepted/rejected counts and final split sizes. It SHALL fail if validation leaves no usable training or validation data. The training entry SHALL reject unvalidated or subsequently changed prepared data.

#### Scenario: The same inputs are prepared twice
- **WHEN** the same data, tokenizer and seed are supplied
- **THEN** the prepared examples, split assignment and provenance hashes are identical

#### Scenario: Prepared data changes after validation
- **WHEN** the launcher observes content differing from the validated candidate hashes
- **THEN** it refuses to begin training until that candidate is prepared and validated again

### Requirement: Guarded isolated local continuation
The full local continuation SHALL use a separate candidate output, preserve v4, and start only after source validation, independent review and a short probe with finite training/validation loss and no memory failure. Launch SHALL record the resolved configuration and process/log identity and refuse competing training. Completion or quality improvement MUST NOT be claimed from launch alone.

#### Scenario: Preparation and probe pass
- **GIVEN** the owner authorized local training and the required local resources are available
- **WHEN** data/source checks and independent review pass and the short probe has finite loss
- **THEN** the full isolated continuation starts and reports its live process and log without replacing v4

#### Scenario: Probe fails or training already runs
- **WHEN** the probe reports nonfinite loss/memory failure or another training process owns the resources
- **THEN** the full run does not start and the exact failure or competing process is reported
