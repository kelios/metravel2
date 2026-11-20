## 1. Implementation

- [x] 1.1 Add cursor reads, bounded quiet intervals, foreground refresh and numbered history.

## 2. Validation

- [x] 2.1 Measure ten quiet minutes with fifty seeded messages. Hook tests on a virtual clock counted 60 + 20 reads before and 11 + 6 after, with zero repeated message bodies. Cover catch-up and session boundaries.
- [x] 2.2 Verify the published conversation screen in Chromium. A quiet ten-minute window on the production QA account recorded 80 reads before and 17 after. Quiet cursor responses contained no message bodies. Web commit `bb794d176`, backend commit `0d8af2a2`.

Production response counts on the previous version were 60 message reads and 20 thread-list reads (77 HTTP 200, three HTTP 502). On the new version all 11 cursor reads returned HTTP 200 with zero message bodies. Five of six thread-list reads returned HTTP 200. One returned HTTP 502 and the following scheduled read succeeded.
