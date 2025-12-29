---
summary: Regression & pre-prod checklist with bash commands
---

# MeTravel Regression & Pre-Prod Checklist (Web / iOS / Android)

## 1) Smoke before deep regression
- App launches (web, iOS sim/device, Android emu/device) with correct icon/splash.
- No red screens, no console errors in first minute.
- Feature flags/env picked from target env (.env.dev / .env.preprod / .env.prod).

## 2) Core user flows (happy paths)
1. Auth
   - Email/password login and logout
   - Social login (if enabled) or graceful fallback
   - Expired token handling: if backend returns 401 and refresh fails, app should auto-logout (UI must switch to logged-out state)
2. Search & filters
   - Search by destination/date; filters open/close; results update
   - Pagination/scroll lists smooth (no jank); scroll position restore
3. Travel card/grid/list
   - Cards render stable sizes; no flicker; tap opens detail
   - Favorites add/remove persists after refresh
4. Travel detail
   - Media gallery swipe/zoom; map renders location pin
   - Itinerary/FAQ tabs switch without layout jumps
5. Booking/checkout (if enabled in env)
   - Price breakdown correct; coupon/discount applied
   - Payment submission success + duplicate-submit guard
6. Profile & settings
   - Edit profile saves; avatar upload; preferences persist
   - Privacy/consent toggles persist and apply
7. Notifications
   - Push/web notifications permission request; test message received (if enabled)
8. Offline/poor network
   - Empty/error states show; retry works; no infinite spinners

## 3) Regressions on known risk areas
- ListTravel & TravelsGrid: no card flicker, correct columns (desktop 3 max, mobile 1), smooth scroll.
- Scroll handlers: no excessive raf/thrashing; sessionStorage debounced (web).
- Skeletons: only show when loading; hide when data ready.
- Responsive: mobile ≤768px single-column; no double padding; images not cropped.

## 4) Non-functional checks
- Performance: LCP/INP within thresholds (see E2E env vars below).
- Accessibility: keyboard focus, screen-reader labels on buttons/inputs, sufficient contrast.
- Security: no secrets in network calls; HTTPS endpoints; logout clears tokens.

## Auth / tokens — notes

- **Source of truth**
  - `AuthContext` considers a user authenticated when `userToken` exists in secure storage.
  - API requests attach `Authorization: Token <userToken>`.
- **Refresh flow**
  - On 401 responses, the API client tries to refresh the access token via `/user/refresh/` using `refreshToken`.
  - If refresh succeeds, the request is retried with the new token.
  - If refresh fails, tokens are cleared and an auth invalidation handler resets `AuthContext` state (prevents UI showing “logged in” with an expired token).

## 5) Data & env
- Test accounts ready for each env; payments in sandbox.
- Required files present: app.json, eas.json, .env.<env>, google-services.json (Android), android-keystore.jks, ios provisioning handled by EAS.

## 6) Bash commands (build/test/deploy)
### Environment helper
- `./env.sh dev` | `./env.sh preprod` | `./env.sh prod`

### Web
- Dev: `npm run web`
- Prod serve: `npm run web:prod`
- Build: `npm run build:web`
- Prod build export: `npm run prod:web`

### Testing
- Unit/UI: `npm run test` (watch all), `npm run test:run` (single run, no interactive), `npm run test:watch` (watch changed files only), `npm run test:coverage`
- E2E (Playwright web):
  - Start web: `npm run web`
  - Run headless: `BASE_URL=http://localhost:19006 npm run e2e`
  - Headed/UI: `BASE_URL=http://localhost:19006 npm run e2e:headed` or `npm run e2e:ui`
  - Custom thresholds: `E2E_CLS_MAX=0.05 E2E_LCP_MAX_MS=4500 E2E_INP_MAX_MS=250 BASE_URL=http://localhost:19006 npm run e2e`

### iOS
- Prebuild check: `npm run ios:prebuild` or `./scripts/ios-prebuild.sh`
- Build (EAS): `npm run ios:build:dev` | `npm run ios:build:preview` | `npm run ios:build:prod`
- Interactive build menu: `./scripts/ios-build.sh`
- Submit latest: `npm run ios:submit:latest` or `./scripts/ios-submit.sh`

### Android
- Prebuild check: `npm run android:prebuild` or `./scripts/android-prebuild.sh`
- Build (EAS): `npm run android:build:dev` | `npm run android:build:preview` | `npm run android:build:prod`
- Interactive build menu: `./scripts/android-build.sh`
- Submit latest: `npm run android:submit:latest` or `./scripts/android-submit.sh`

### Multi-platform
- Build all: `npm run build:all:dev` | `npm run build:all:preview` | `npm run build:all:prod`

### EAS utils
- List builds: `eas build:list --platform ios` | `eas build:list --platform android`
- Download latest: `eas build:download --platform ios --latest` | `eas build:download --platform android --latest`
- Submit specific build: `eas submit --platform ios --id <BUILD_ID>` | `eas submit --platform android --id <BUILD_ID>`

### Expo export helper
- Full export & archive (web): `./build.sh` (applies env, exports web bundles, archives dist/<env>.tar.gz)

## 7) Release gates before prod submit
- All tests green (unit + e2e); coverage acceptable.
- Version incremented in app.json (app + platform codes).
- Store assets correct (icon, splash, adaptive icon, screenshots if needed).
- Production build succeeds (EAS) and smoke-tested on real devices.
- For Android submit: confirm track (internal/alpha/beta/production) in `./scripts/android-submit.sh`.
- For iOS submit: confirm build ID/last build in `./scripts/ios-submit.sh`.

## 8) Quick bug-hunt checklist
- Infinite spinners/blank states
- Crashes on tab switches/navigation
- Misaligned images/text on mobile
- Payment double-charge prevention
- Localization: key placeholders shown
- Network error handling shows user-friendly message

## 9) Evidence to capture
- Screenshots/recordings of critical flows (search → detail → booking/checkout).
- Logs for any warnings from expo-doctor / EAS build.
- Device/OS matrix covered (iOS, Android, Chrome/Safari/Firefox desktop + mobile widths).

## 10) Regression results — 2025-12-19
Context: IDE-only pass; app not runnable here, so checks are reasoning/coverage review + unit test run. Needs validation on real web/mobile builds.

- Scope: Web (reasoned); iOS/Android (not run).
- Automated tests: **ran** `npm run test:run` → **FAIL** (2 suites failing in ListTravel delete confirmations).
- E2E/Perf: not executed (env not available).

Findings
- [ ] Smoke: not run (no runtime)
- [ ] Auth: not run
- [ ] Search & filters: not run
- [ ] Travel card/grid/list: not run
- [ ] Travel detail: not run
- [ ] Booking/checkout: not run
- [ ] Profile & settings: not run
- [ ] Notifications: not run
- [ ] Offline/poor network: not run
- [ ] Regression risk areas (ListTravel/TravelsGrid/skeletons/responsive): not re-validated
- [ ] Accessibility: not run
- [ ] Security: not run
- [ ] Device matrix: not run
- [ ] Unit tests: **FAIL** — ListTravel delete flow tests expect `confirm` to be called (timeout/403/delete paths); confirm mock not triggered.

Notes/TODO for next run
- Spin up web build (npm run web) and mobile emulators to execute the above flows.
- Fix ListTravel delete confirmation tests (ensure web `confirm` mock is invoked or adjust flow/mocks), then re-run `npm run test:run`.
- Run unit/UI tests (`npm run test:run` or `npm run test:coverage`) and playwright E2E (`BASE_URL=http://localhost:19006 npm run e2e`).
- Capture screenshots of search → detail → booking; verify skeletons and grid columns on desktop (max 3) and mobile (single column ≤768px).
