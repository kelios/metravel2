## 1. Implementation

- [x] 1.1 Add cursor reads, bounded quiet intervals, foreground refresh and numbered history.

## 2. Validation

- [x] 2.1 Measure ten quiet minutes with fifty seeded messages. Hook tests on a virtual clock counted 60 + 20 reads before and 11 + 6 after, with zero repeated message bodies. Cover catch-up and session boundaries.
- [ ] 2.2 Review, publish, and verify the supported API through the conversation screen.
