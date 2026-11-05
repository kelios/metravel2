## 1. Shared production prompts

- [x] 1.1 Specify acted shots, voice planning, capability checks and final acceptance in the shared animated Reel skill.
- [x] 1.2 Align the season and likeness rules, and add a fully timed pilot with a speaking-shot probe.
- [x] 1.3 Route the agent and general Reel entry points to the shared contract and regenerate the mirrors.

## 2. Evidence

- [x] 2.1 Validate metadata and mirrors, and walk through the rejected photo montage, pilot plan and unavailable-renderer paths against the requirements.
- [x] 2.2 Validate the OpenSpec change before closure.

Evidence: prompt audit, both mirror checks, both skill validators and strict
OpenSpec validation passed. The pilot has eight contiguous shots over 31.5 s.
Local speech timing via `say` and `ffprobe` fit all four windows after one line
was shortened. The first cut used three JPEGs. The working cut later used five
JPEGs and still had no audio stream, so both fail the finished animation
criteria. The unavailable-renderer branch returns a labeled draft. A rendered
speaking-shot probe remains the next production step.
