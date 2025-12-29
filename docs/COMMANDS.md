# MeTravel - Quick Commands Reference

Быстрый справочник всех доступных команд для разработки, сборки и публикации.

---

## 🚀 Development

```bash
# Start development server
npm start

# Platform specific
npm run web          # Web browser
npm run ios          # iOS simulator
npm run android      # Android emulator

# Environment selection
./env.sh dev         # Development
./env.sh preprod     # Pre-production
./env.sh prod        # Production
```

---

## 🌐 Web

```bash
# Development
npm run web

# Production
npm run web:prod

# Build
npm run build:web

# Production build
npm run prod:web
```

---

## 📱 iOS

### Prebuild & Check
```bash
npm run ios:prebuild          # Check project readiness
./scripts/ios-prebuild.sh     # Same as above
```

### Build
```bash
npm run ios:build:dev         # Development (Simulator)
npm run ios:build:preview     # Preview (TestFlight)
npm run ios:build:prod        # Production (App Store)

./scripts/ios-build.sh        # Interactive menu
```

### Submit
```bash
npm run ios:submit:latest     # Submit latest build
./scripts/ios-submit.sh       # Interactive submit
```

---

## 🤖 Android

### Prebuild & Check
```bash
npm run android:prebuild          # Check project readiness
./scripts/android-prebuild.sh     # Same as above
```

### Build
```bash
npm run android:build:dev         # Development (APK)
npm run android:build:preview     # Preview (APK)
npm run android:build:prod        # Production (AAB)

./scripts/android-build.sh        # Interactive menu
```

### Submit
```bash
npm run android:submit:latest     # Submit latest build
./scripts/android-submit.sh       # Interactive submit
```

---

## 🔄 Multi-Platform

```bash
# Build for both iOS and Android
npm run build:all:dev         # Development builds
npm run build:all:preview     # Preview builds
npm run build:all:prod        # Production builds
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test

# Coverage report
npm run test:coverage
```

---

## 🧭 E2E (Playwright) — Web Vitals

```bash
# 1) Start Expo Web (Terminal A)
npm run web

# 2) Run e2e in Chromium (Terminal B)
# BASE_URL должен указывать на запущенный web (по умолчанию Playwright config использует http://localhost:19006)
BASE_URL=http://localhost:19006 npm run e2e

# Headed
BASE_URL=http://localhost:19006 npm run e2e:headed

# UI mode
BASE_URL=http://localhost:19006 npm run e2e:ui
```

### Пороги (env)

```bash
# По умолчанию:
# E2E_CLS_MAX=0.02
# E2E_LCP_MAX_MS=3500
# E2E_INP_MAX_MS=200

E2E_CLS_MAX=0.05 E2E_LCP_MAX_MS=4500 E2E_INP_MAX_MS=250 BASE_URL=http://localhost:19006 npm run e2e
```

---

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

# Post-install fixes
npm run postinstall
```

---

## 📦 EAS Commands

### Build
```bash
# Check build status
eas build:list --platform ios
eas build:list --platform android

# Download build
eas build:download --platform ios --latest
eas build:download --platform android --latest

# View build details
eas build:view

# Cancel build
eas build:cancel
```

### Submit
```bash
# Submit to stores
eas submit --platform ios --latest
eas submit --platform android --latest

# Submit specific build
eas submit --platform ios --id BUILD_ID
eas submit --platform android --id BUILD_ID
```

### Credentials
```bash
# Manage credentials
eas credentials

# View credentials
eas credentials --platform ios
eas credentials --platform android
```

### Project
```bash
# Initialize EAS
eas init

# Login
eas login

# Logout
eas logout

# Check project status
eas project:info
```

---

## 🔍 Diagnostics

```bash
# Expo doctor
npx expo-doctor

# Check Expo version
npx expo --version

# Check EAS CLI version
eas --version

# Check Node version
node --version

# Check npm version
npm --version
```

---

## 🧹 Cleanup

```bash
# Clean all caches
npm run clean
rm -rf node_modules
rm -rf .expo
npm install

# Clean Android build
rm -rf android/.gradle
rm -rf android/app/build

# Clean iOS build (if exists)
rm -rf ios/build
rm -rf ios/Pods
```

---

## 📊 Build with Options

### Clear cache
```bash
eas build --platform ios --profile production --clear-cache
eas build --platform android --profile production --clear-cache
```

### Auto-submit
```bash
eas build --platform ios --profile production --auto-submit
eas build --platform android --profile production --auto-submit
```

### Local build
```bash
eas build --platform ios --local
eas build --platform android --local
```

### Non-interactive
```bash
eas build --platform ios --profile production --non-interactive
eas build --platform android --profile production --non-interactive
```

---

## 🔐 Environment Variables

```bash
# Copy example files
cp .env.production.example .env.prod

# Edit environment
nano .env.prod
vim .env.prod
```

---

## 📝 Git

```bash
# Create release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# View tags
git tag -l

# Delete tag
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

---

## 🚨 Emergency Commands

### Build stuck
```bash
# Cancel current build
eas build:cancel

# Clear cache and rebuild
eas build --platform android --profile production --clear-cache
```

### Credentials issues
```bash
# Reset credentials
eas credentials

# Remove and re-add
# Select platform > Remove credentials > Set up new credentials
```

### Node modules issues
```bash
# Complete reset
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## 📚 Documentation Commands

```bash
# View documentation
cat README.md
cat ANDROID-README.md

# View guides (all docs live in ./docs)
cat docs/ANDROID-BUILD-GUIDE.md
cat docs/ANDROID-QUICK-START.md
cat docs/ANDROID-CHECKLIST.md

# View iOS docs
cat docs/IOS-BUILD-GUIDE.md
cat docs/IOS-QUICK-START.md
```

---

## 🎯 Quick Workflows

### First time setup
```bash
npm install
npm install -g eas-cli
eas login
eas init
```

### Development workflow
```bash
npm run android:prebuild
npm run android:build:dev
# Download APK and test
```

### Production release
```bash
# 1. Update version in app.json
# 2. Run build
./scripts/android-build.sh
# Select option 3 (Production)
# 3. Submit
npm run android:submit:latest
```

### Quick test
```bash
npm test
npm run format
npm run android:build:dev
```

---

## 💡 Tips

### Check everything before release
```bash
npm run check-deps
npm run test:coverage
npm run android:prebuild
```

### Monitor builds
```bash
# Watch build progress
eas build:list --platform android --limit 5

# View specific build
eas build:view BUILD_ID
```

### Parallel builds
```bash
# Build both platforms simultaneously
npm run build:all:prod
```

---

**Сохраните этот файл для быстрого доступа к командам!**
