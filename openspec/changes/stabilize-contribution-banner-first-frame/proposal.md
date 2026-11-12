## Why

The shared contribution banner changes from its width-zero mobile geometry to its desktop geometry after hydration. On a cold 1280×720 Places visit this produces a measured 0.15542 layout-shift entry and total CLS 0.15728, failing the mandatory performance guard for #3382. Linked prerequisite #3386 fixes the banner boundary while retaining its current final appearance and actions.

## What Changes

- Describe regular and compact banner geometry, including its existing container padding tiers, once in CSS-safe breakpoint registries consumed by React and critical CSS.
- Mark existing banner nodes and action buttons so the browser applies the final viewport geometry before hydration.
- Forward an optional standard dataset through the existing Button Pressable on web; native receives no dataset.
- Cover real banner/container server markup and hydration, both density/action branches, breakpoint tiers and native controls.

Non-goals: no global ResponsiveContainer or responsive-hook rewrite, Places reserve, extra wrapper, hidden content, delayed mounting, data/API change, authored text, new translation, analytics event or budget relaxation. Existing API fixtures remain test-only; production acceptance uses real article data and media.

## Capabilities

### New Capabilities

- `contribution-banner-first-frame`: contribution banners retain their viewport-correct geometry across the static HTML to hydrated runtime transition.

### Modified Capabilities

None.

## Impact

- Platform impact: desktop and mobile web first-frame geometry. Native keeps the same current layout and interaction contract and receives no web markers; no native renderer or capability changes.
- Localization impact: none; RU/BE/UK/PL/EN copy and formatting remain unchanged.
- Code: shared ContributionBanner, its new layout registry, critical CSS emission, CSS-safe padding type keys and optional Button dataset forwarding. ResponsiveContainer itself is unchanged.
- User-visible/performance impact: prevent the initial banner reflow, including callers on Places and the travel footer. Final mobile/desktop geometry is preserved.
- API/data/SEO/security impact: none; endpoints, payloads, metadata, link destinations and trust boundaries are unchanged.
- Accessibility/analytics impact: existing labels, roles, focus, disabled/press behavior, impression and click events remain unchanged.
- Dependencies: no new package. Independent code review and formal gate precede publication; unchanged full slider guards, final published travel CLS ten and Lighthouse five remain required.
