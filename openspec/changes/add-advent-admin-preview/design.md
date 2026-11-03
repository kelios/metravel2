## Context

The calendar already has all door content and the public door state derives from local campaign dates and recorded progress.

## Goals / Non-Goals

Provide access to every door from the production Advent page for signed-in superusers. This is a UI preview for existing public bundle content, with no claim of content secrecy or simulation of backend task credit.

## Decisions

Gate the explicit toggle on hydrated authenticated superuser state. Use the existing calendar and door sheet with transient preview selection and task completion. Keep the real date and campaign config, avoiding a date override that would also affect ordinary campaign behavior. Preview interactions bypass Advent progress writes and campaign analytics. Closing a door resets its preview completion so it can be tested again.

## Risks / Trade-offs

External links and ordinary site actions remain real. Verify role loss immediately hides the preview and test that future door selection cannot reach persistent progress.
