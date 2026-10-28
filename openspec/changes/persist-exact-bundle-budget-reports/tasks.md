## 1. Exact report

- [x] 1.1 Add versioned report metadata, strict schema validation and atomic bounded persistence.
- [x] 1.2 Capture exact named/file/aggregate/route/payload measurements and failures in the canonical guard without changing legacy fields or verdicts.
- [x] 1.3 Enable persistence through canonical build/deploy and add exact comparison CLI.

## 2. Verification and handoff

- [x] 2.1 Add focused success/fail/incomplete/precision/atomicity/retention/cleanup/comparison fixtures and run scoped checks.
- [ ] 2.2 Complete independent code review and publish the reviewed task commit through the normal board gate.
- [ ] 2.3 Reuse the next already-required canonical export to verify exact report, source SHA, original verdict and post-cleanup comparison; no duplicate build/deploy.
- [x] 2.4 Validate the OpenSpec change and record evidence and remaining retest trigger.
