## Context

See proposal.md for the linked #3386 prerequisite and goal. The guard records a compact banner card `(360,282,904,222)→(392,312,840,128)` and a following grid at `514→480`. The existing banner uses a width-zero mobile snapshot and the nested container's small-phone padding in the exported HTML. On desktop the container switches from 8/4 to 40/32 horizontal/vertical padding, the wrapper adds 2 pixels above and below, and the card becomes a row. The raw deltas match exactly: X+32, width−64, Y+30, height−94 and following content−34.

The banner also appears in the travel footer. Its new source invalidates final travel geometry/performance evidence, so the earlier 4c8d ten-run PASS remains historical and the final published revision must receive its own primary ten and Lighthouse five.

## Goals / Non-Goals

**Goals:** one owner for each responsive geometry value, final viewport geometry in static HTML, preserved regular/compact and guest/authenticated/campaign action branches, no native web-marker leakage.

**Non-Goals:** no new layout wrapper, deferred mount or visibility state; no global responsive-hook/container migration; no Places-specific reserve or test budget change; no API/media/copy/analytics change.

## Decisions

Use the existing `defineBreakpointLayout`/`breakpointStyle`/`breakpointLayoutProps` bridge in a new `components/common/contributionBannerLayout.ts`. Separate regular and compact scopes describe wrapper, card, text, buttons, action width and typography at the existing 768-pixel boundary. Ascending container tiers preserve 360/768/1024/1920 padding and max-width behavior. The banner reads those exact objects for runtime styles; `utils/criticalCSSBuilder.ts` serializes them for the first frame.

Keep `ResponsiveContainer` and `useResponsive` unchanged. Pass only existing style/dataset inputs to that container. Add CSS-safe padding longhand type keys to `utils/breakpointLayout.ts`; its serializer/runtime remains unchanged.

The existing noncampaign Button actions change `fullWidth` across the same responsive transition. Expose only optional standard dataset forwarding in `components/ui/Button.tsx` on its existing web Pressable so the ordinary action-width registry marker reaches the real node. Native omits this prop. Do not add child-selector special cases, wrapper nodes or change Button defaults, styles, disabled, press or accessibility behavior.

Rejected alternatives: `clientOnly` cannot be applied to an invitation already present in server HTML; a Places reserve leaves the shared geometric cause; globally rewriting every ResponsiveContainer consumer expands the prerequisite beyond its owning banner.

## Risks / Trade-offs

- [Density or tier cascade mismatch] → separate density scopes, ascending container rules and known-value tier parity tests.
- [Button width still changes despite parent correction] → marker forwarding on the actual action and real DOM coverage of campaign and ordinary guest buttons.
- [Native behavior drift] → retain current runtime values and check no web markers reach native controls; no native renderer/capability changes.
- [Travel footer geometry changes] → retain existing failed/successful evidence honestly and repeat final published primary ten and Lighthouse five.

## Migration Plan

Write focused failing first-frame coverage, apply the shared registry bridge, run source checks after the parent's quality release, then obtain independent full-diff audit and formal gate. Commit only explicit prerequisite paths, push main and publish canonically. Require unchanged full slider guards, mobile/desktop Places cold acceptance and the final exact-SHA travel series before closing. Rollback is the whole explicit prerequisite commit; it does not revert the separate 18-path travel transition fix.
