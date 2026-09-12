<!-- Reviewer-facing guide (English). Source of truth for the PDF attached to App Review
messages. Rebuild: python3 md->html + Playwright page.pdf (see docs/IOS_STORE_LISTING.md
«App Review guide»). Prepared 13.09.2026 for 1.0.5 (9); update the "what is prepared"
section whenever the demo account content changes. No credentials here by design. -->


# MeTravel — App Review Guide

**Version 1.0.5 (9) · Bundle ID `by.metravel.app` · Universal iPhone/iPad**

This guide is a reviewer-facing companion to the App Review Information notes
already submitted in App Store Connect. It does not repeat or replace the
demo-account credentials, which stay in the protected ASC fields.

## 1. Overview

MeTravel is a free travel guide and trip-planning app. There are no
in-app purchases or subscriptions; some hotel/tour links in articles are
affiliate links to third-party booking partners. The interface is available in
five languages (Russian, Belarusian, Ukrainian, Polish, English); the
author-contributed catalogue of articles and city quests is mainly in Russian,
and changing the interface language does not translate that content.

The app has four main areas:

- **Travel articles** — trip reports with photos, map points, and practical
  notes.
- **Map** — an interactive map of route points and places.
- **City quests** — self-guided walking routes with a story and a task at each
  stop.
- **Trip planner** — a personal itinerary builder with route points,
  overnight stops, a gear checklist, and a calendar of personal travel plans.

## 2. Getting started as a guest

No account is required to explore the public catalogue:

1. Launch the app. It opens on the **Home** tab ("Куда поехать" / "Where to
   go") with no forced sign-in.
2. Open **Travels** to browse articles; tap one to read the story, photos, and
   its route on the map.
3. Open the **Map** tab to see route points and places without signing in.
4. Open **Quests** to see the list of city quests; open one to read the intro
   and the first steps.
5. As a guest, a quest can be played up to its first two steps; continuing
   further, saving favorites, or planning a trip prompts sign-in.

## 3. Reviewer account — what is prepared

The reviewer demo account (credentials in the protected App Review
Information fields only) is prepared with sample content so the review can
exercise the main flows without any extra setup:

- **6 favourite travel articles** (Belarus lakes, castles and manors), saved
  from their article screens. In this build, favourites hold travel articles;
  quests keep their own progress instead.
- A **planned trip** — "Weekend at Braslav Lakes", 19–20 September 2026 —
  private, with 4 route points including one overnight stop (with address,
  booking link, price and check-in fields) and a 6-item gear checklist, two
  items already marked as owned/packed.
- The **Minsk city quest "Цмок"** (Tsmok) with the first 2 steps already
  completed, so the review can see both the completed-step state and the
  remaining flow.
- A **personal plan** named "Рысы" on **19 September 2026** in the Calendar,
  under the "Планирую" ("Planning") status.

## 4. Feature walkthroughs

### 4.1 Articles & map

1. Open **Travels**, pick an article from the catalogue.
2. Scroll the article: cover, photo gallery, trip narrative, and practical
   details (how to get there, what to see).
3. Open the article's embedded map to see its route points.
4. From the standalone **Map** tab, pan/zoom the base map and open a place
   marker's popup for details.
5. From a place popup, use the external-navigation action to hand off to a
   maps app.

### 4.2 City quests

1. Open **Quests**, choose a city, then a quest.
2. Read the intro, then start the first step: location, story, and task.
3. Submit an answer; an incorrect first attempt surfaces a **hint**.
4. Continue through the remaining steps to the finale (story + video).
5. Progress is kept locally (so it survives app restarts and works
   **offline**) and is merged with the signed-in account's server progress
   once online — neither side "wins," they combine.
6. As a guest, only the first 2 steps are playable; the rest require sign-in.

### 4.3 Favorites

1. On a travel article, tap the heart/favourite action to save it.
2. Open the **Favorites** tab to see the saved articles.
3. Remove an item from Favorites the same way it was added.
4. Signed-out users see a sign-in prompt instead of the list.

### 4.4 Trip planner

1. Open the **Trips** tab and start (or open) a planned trip.
2. Add route points to the itinerary; reorder or edit them.
3. Mark one point as an **overnight stop**; a booking-reference field appears
   only for that point type.
4. Open the trip's **gear checklist** and add or check off items (a
   hiking-template shortcut is available).
5. Open the **Calendar** tab, switch to the "Планирую" ("Planning") view, and
   open the personal plan entry to see its date and details.

### 4.5 Profile & settings

1. Open the **Profile** tab to see the signed-in account's public profile.
2. Open **Settings** to review account info, language, and app version/build.
3. Settings also exposes sign-out and account deletion (section 4.7).

### 4.6 Report & block (public author profile → safety menu)

1. Open another user's **public author profile** (for example, from an
   article's byline or a comment).
2. Tap the profile's overflow (**⋯**) action to open the safety menu.
3. Tap **Complain** to report the author: choose a reason (spam, harassment,
   scam, inappropriate content, fake account, or other), add an optional
   comment, and submit.
4. From the same menu, tap **Block** to block the author; a blocked author
   can no longer see the reviewer's content or contact them.
5. To reverse it, reopen the safety menu on the same profile and tap
   **Unblock**.

### 4.7 Account deletion

1. Open **Settings**.
2. In the account card, tap **Delete account**.
3. Confirm the destructive action in the dialog that follows.
4. The session ends and the app returns to the signed-out state.

Use a disposable account for this flow — never the persistent reviewer demo
account.

## 5. Universal Links

All three links below were verified to return **HTTP 200** on
`https://metravel.by` and are covered by the live
`https://metravel.by/.well-known/apple-app-site-association` (`applinks:
metravel.by`, associated domain declared in the app):

| Type | URL | AASA coverage |
| --- | --- | --- |
| Article | `https://metravel.by/travels/otdykh-v-dominikane-chto-posmotret-i-ekskursii` | `"/travels/?*"` |
| City quest | `https://metravel.by/quests/4/minsk-cmok` | `"/quests/?*/?*"` |
| Map | `https://metravel.by/map` | `"/map"` |

Opening any of these links on the device (Notes, Messages, Safari address
bar) while the app is installed should hand off into the matching in-app
screen instead of a browser tab.

## 6. Permissions

Permissions are requested contextually, by the specific action that needs
them — never at launch. There is no App Tracking Transparency prompt (no
`NSUserTrackingUsageDescription` is declared) and no background location
(`UIBackgroundModes` is not declared; background location is explicitly
disabled in configuration).

| Permission | When it is asked | What happens on deny |
| --- | --- | --- |
| Location — When In Use | Tapping the locate-me control on the Map tab, "nearby" quests, the in-quest point navigator, or the trip route picker | The feature that needed it (e.g. auto-centering, "nearby") is unavailable; manual browsing of the map and catalogue continues normally |
| Motion | Alongside location, to support direction/heading while navigating a route or quest on foot | Direction-aware features degrade gracefully; the rest of navigation still works |
| Photo Library | Choosing a photo in the trip/article editor or profile photo picker | The picker simply has nothing to select; the user can try Camera instead or cancel |
| Camera | Choosing "take a photo" in the same editors | The photo action is unavailable; the user can pick an existing photo instead |
| Face ID | Only if the user opts into biometric sign-in | Sign-in falls back to the standard password/OAuth flow |

Push notifications use the standard system prompt and are opt-in from
Settings (Notifications), not requested automatically at first launch.

## 7. User-generated content & moderation

- Reports submitted through **Complain** go to the team's moderation queue and
  are reviewed within **24–48 hours**.
- Reviewer or user questions about a report/moderation outcome can be sent to
  **metraveldev@gmail.com**.
- A blocked user can no longer see the blocking user's content or contact
  them; blocking is reversible from the same safety menu (**Unblock**).
- Terms of use: <https://metravel.by/terms>
- Privacy Policy: <https://metravel.by/privacy>

## 8. External services

MeTravel's own API handles accounts, content, trip plans, and the
report/block safety flow described above. Quest progress and attempts support
app functionality and analytics, linked to the installation and, once signed
in, the account. Sign-in exchanges tokens/account details with Apple and
Google (Meta SDK is bundled but Facebook sign-in is disabled in this build).
Amazon S3 stores media and backups; outbound account email uses Gmail SMTP.
Push notifications use Expo/APNs. Optional Telegram linking associates a
Telegram account. Articles can embed Instagram/YouTube content in web views.
Maps and routing use Leaflet/OpenStreetMap, Nominatim/BigDataCloud
(geocoding), OpenRouteService/Valhalla/OSRM (routing), and Open-Meteo
(weather/elevation); optional map layers use Esri, OpenTopoMap,
WaymarkedTrails, Overpass, Polish forestry services, and OpenWeatherMap.
Destination-based partner offers (Belkraj/Tripvenue, Travelpayouts, Tripster,
Ostrovok) are shown via WebView/external links. No payment-card details are
collected in-app; partner providers handle their own bookings/payments.

## 9. Test devices

- **iPad mini 6**, iPadOS 26.6.2 — used for the physical-device demonstration
  video.
- **iPhone 13 mini**, iOS 26.5 — used to verify cross-device compatibility of
  the same build.

---

*Prepared for MeTravel 1.0.5 (9). No secrets, passwords, UDIDs, Team ID, or
the demo-account email are included in this document; those remain in the
protected App Review Information fields in App Store Connect.*
