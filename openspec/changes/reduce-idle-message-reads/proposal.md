## Why

A quiet open conversation currently downloads the latest fifty messages sixty times in ten minutes. Its thread list refreshes twenty times in the same window.

## What Changes

Use the message changes cursor introduced by backend task #3461. Back off both polls while the screen is quiet, suspend polling in the background, and read changes promptly on return or send. Retain numbered history and support the previous route during rollout.

## Capabilities

### New Capabilities

- `thread-message-polling` defines message synchronization and polling cadence.

## Impact

Shared messaging hooks, API adapter, and regression coverage on web and native.
