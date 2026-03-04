# MeTravel - React Native Travel App

Cross-platform travel application built with React Native and Expo.

## 🎉 Latest Updates (January 3, 2026)

### ✅ Map Page Improvements

**Phase 1 - Core Features**:
- ✅ Distance & travel time calculation (🚗🚴🚶)
- ✅ Smart recommendations ("Popular Nearby")
- ✅ Preferences persistence
- ✅ 17 unit tests (100% pass rate)

**Phase 2 - Mobile Enhancements**:
- ✅ Bottom Sheet panel (3 states)
- ✅ Floating Action Button
- ✅ Swipeable gestures
- ✅ Peek Preview
- ✅ Auto layout switching

📖 **Details**: [`DEVELOPER_GUIDE_TRAVEL_FORM.md`](./DEVELOPER_GUIDE_TRAVEL_FORM.md#-улучшения-карты-январь-2026)

---

## 📱 Platforms

- ✅ **Web** - Production ready (OpenStreetMap)
- ✅ **iOS** - Ready for App Store (Apple Maps)
- ✅ **Android** - Ready for Google Play Store (no Google Maps API needed)

## 🗺️ Maps (100% Free Solutions)

**✅ NO Google Maps API Key required!**

We use **only free, open-source mapping solutions**:

| Platform | Solution | Cost | API Key? |
|----------|----------|------|----------|
| **iOS** | Apple Maps (native) | Free | ❌ Not needed |
| **Android** | Google Maps (built-in) | Free | ❌ Not needed |
| **Web** | OpenStreetMap + Leaflet | Free | ❌ Not needed |
| **Routing** | OpenRouteService | Free* | ✅ Optional (2,500 req/day free) |

*Get free OpenRouteService key at: https://openrouteservice.org/sign-up/*

📖 **Documentation:** [docs/INDEX.md](./docs/INDEX.md)

### Optional: Setup Routing (OpenRouteService)

```bash
# Get your free API key at https://openrouteservice.org/sign-up/
./scripts/setup-ors-key.sh YOUR_API_KEY

# Or manually add to .env:
echo "EXPO_PUBLIC_ORS_API_KEY=your_key" >> .env
```

**Free tier limits:**
- 2,500 requests/day
- 40 requests/minute
- All transport types (car, bike, foot)

## 🚀 Quick Start

### Prerequisites

- Node.js 18.17.1 or higher
- npm or yarn
- For iOS: macOS, Xcode 14.0+, EAS CLI
- For Android: EAS CLI, Google Play Developer account
- **(Optional)** OpenRouteService API key for routing (free: https://openrouteservice.org)

### Installation

```bash
# IMPORTANT: run all npm commands from this folder (it contains package.json)
# metravel2/metravel2

# Install dependencies
npm install

# Create .env file
cp .env.dev .env

# Set environment variables
EXPO_PUBLIC_API_URL=https://metravel.by
EXPO_PUBLIC_IS_LOCAL_API=false

# Optional: Add OpenRouteService key for routing
EXPO_PUBLIC_ROUTE_SERVICE_KEY=your_free_key_from_openrouteservice.org
```

### Development

```bash
# Start development server
npm start

# Or with environment selection
./env.sh dev

# Platform specific
npm run web      # Open web build
npm run ios      # Open iOS simulator
npm run android  # Open Android emulator
```

## 📦 Build & Deploy

### Web

```bash
# Development
npm run web

# Production
npm run web:prod

# Build for production
npm run build:web
```

### iOS

```bash
# Quick start
npm run ios:prebuild  # Check project readiness
npm run ios:build     # Interactive build menu

# Direct commands
npm run ios:build:dev      # Development build
npm run ios:build:preview  # Preview build
npm run ios:build:prod     # Production build

# Submit to App Store
npm run ios:submit:latest
```

**📖 Documentation**: See [docs/INDEX.md](./docs/INDEX.md)

### Android

```bash
# Quick start
npm run android:prebuild  # Check project readiness
npm run android:build     # Interactive build menu

# Direct commands
npm run android:build:dev      # Development build (APK)
npm run android:build:preview  # Preview build (APK)
npm run android:build:prod     # Production build (AAB)

# Submit to Google Play
npm run android:submit:latest
```

**📖 Documentation**: See [docs/INDEX.md](./docs/INDEX.md)

### Multi-Platform

```bash
# Build for both iOS and Android
npm run build:all:dev      # Development builds
npm run build:all:preview  # Preview builds
npm run build:all:prod     # Production builds
```

## 🧪 Testing

```bash
# Recommended: use Yarn (repo uses Yarn v1). `npm run ...` also works.
# React Native `0.81.5` requires Node `>= 20.19.4` (see `.nvmrc`).

# Run tests (interactive watchAll)
yarn test

# Run tests with coverage
yarn test:coverage

# Single run (recommended for CI/automation)
yarn test:run

# Run only tests matching a pattern
yarn test:run -- pdf

# Enforce image/card architecture rules
yarn check:image-architecture

# CI-style run (guard + tests)
yarn test:ci

# E2E (Playwright)
yarn e2e
yarn e2e:headed
yarn e2e:ui
```

### CI Quality Gate

- Workflow: `.github/workflows/ci-smoke.yml`
- Gating jobs:
  - `lint` (ESLint JSON report + summary)
  - `smoke-critical` (critical app/API tests + JSON report + summary)
- Aggregation job:
  - `quality-summary` (always runs, combines lint + smoke status, emits one final summary)

Policy:
- On `pull_request`: smoke duration budget is warning-only.
- On `push` to `main`: smoke duration budget strict mode is enabled and can fail the gate.

Local commands to reproduce CI gate:

```bash
yarn lint:ci
yarn test:smoke:critical:ci
node scripts/summarize-eslint.js test-results/eslint-results.json
node scripts/summarize-jest-smoke.js test-results/jest-smoke-results.json
node scripts/summarize-quality-gate.js test-results/eslint-results.json test-results/jest-smoke-results.json --fail-on-missing
```

More details: see `docs/TESTING.md`.

## 🖼 Images & Cards (важно)

После рефакторинга все UI с изображениями должны использовать единый слой.

- **Images (везде)**: используйте `components/ui/ImageCardMedia.tsx`
  - Единый рендер на web/iOS/Android
  - `fit` (`contain|cover`), blur-background, overlay, `loading/priority` для web

- **Travel cards / кликабельные карточки**: используйте `components/ui/UnifiedTravelCard.tsx`
  - Содержит унифицированный layout карточки и использует `ImageCardMedia` внутри

### Что запрещено

- **Не импортировать `expo-image`** в прикладных компонентах `components/**`
  - `expo-image` должен оставаться в low-level слое (`components/ui/OptimizedImage.tsx`)

- **Не импортировать `components/ui/OptimizedImage`** напрямую из фич/карточек
  - Используйте `ImageCardMedia` (он инкапсулирует `OptimizedImage`)

### Guard

В проекте есть проверка архитектуры картинок:

- `npm run check:image-architecture`

Она также запускается в `npm run test:ci`.

## 🛠 Utilities

```bash
# Check dependencies
npm run check-deps

# Format code
npm run format

# Clean cache
npm run clean

# Reset cache
npm run reset
```

## 📁 Project Structure

```
metravel2/
├── app/              # Expo Router pages
├── components/       # React components
├── assets/          # Images, fonts, icons
├── constants/       # App constants
├── context/         # React context
├── hooks/           # Custom hooks
├── src/             # Source code
├── utils/           # Utility functions
├── scripts/         # Build scripts
└├── docs/            # Documentation (single source of truth)
```

## 📚 Documentation

Start here (all documentation lives **only** in `docs/`):

- [docs/INDEX.md](./docs/INDEX.md)
- [docs/README.md](./docs/README.md)
- [docs/RULES.md](./docs/RULES.md)

## 🔌 Backend API

- **Base URL**: configure via `EXPO_PUBLIC_API_URL`
- **Redoc**: `${EXPO_PUBLIC_API_URL}/api/schema/redoc/`
- **OpenAPI schema**: `${EXPO_PUBLIC_API_URL}/api/schema/`
- **Auth header**: `Authorization: Token <token>`

## 🌐 SEO & Indexing

- `public/robots.txt` — Describes crawling rules and sitemap location
- `public/sitemap.xml` — Site structure for search engines

After changes, restart the Expo/Next web server to ensure files are accessible at:
- `https://localhost:8081/robots.txt`
- `https://localhost:8081/sitemap.xml`

## 🔧 Configuration Files

- `app.json` - Expo configuration
- `eas.json` - EAS Build configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Jest testing configuration
- `metro.config.js` - Metro bundler configuration

## 🔐 Environment Variables

Create environment-specific files:
- `.env.dev` - Development
- `.env.preprod` - Pre-production
- `.env.prod` - Production
- `.env.production` - iOS production build

## 📞 Support

- **Issues**: Create an issue in the repository
- **Docs**: See [docs/INDEX.md](./docs/INDEX.md)
- **Expo Forums**: https://forums.expo.dev/
- **Troubleshooting**: Start with [docs/README.md](./docs/README.md)

## 📄 License

Private - All rights reserved

---

**Version**: 1.0.0  
**Last Updated**: December 2024

## 🧰 Reproducible environment (recommended)

- Use Node from `.nvmrc` (recommended: `nvm use`).
- Use npm version pinned in `package.json` via `packageManager`.
- This repo expects `package-lock.json` as the single source of truth for dependencies.

## ✅ Release checks (prod)

```bash
# One command (recommended)
npm run release:check

# Or step-by-step
npm run lint
npm run test:run
npm run build:web
npm run audit:high
./verify-security-fixes.sh
```
