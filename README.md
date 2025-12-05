# MeTravel - React Native Travel App

Cross-platform travel application built with React Native and Expo.

## 📱 Platforms

- ✅ **Web** - Production ready
- ✅ **iOS** - Ready for App Store
- ✅ **Android** - Ready for Google Play Store

## 🚀 Quick Start

### Prerequisites

- Node.js 18.17.1 or higher
- npm or yarn
- For iOS: macOS, Xcode 14.0+, EAS CLI
- For Android: EAS CLI, Firebase account, Google Play Developer account

### Installation

```bash
# Install dependencies
npm install

# Create .env file
cp .env.dev .env

# Set environment variables
PROD_API_URL=https://metravel.by
LOCAL_API_URL=http://192.168.50.4:8000
IS_LOCAL_API=false
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

**📖 Full iOS documentation**: See [docs/IOS-README.md](../docs/IOS-README.md)

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

**📖 Full Android documentation**: See [ANDROID-README.md](./ANDROID-README.md) and [docs/ANDROID-BUILD-GUIDE.md](../docs/ANDROID-BUILD-GUIDE.md)

### Multi-Platform

```bash
# Build for both iOS and Android
npm run build:all:dev      # Development builds
npm run build:all:preview  # Preview builds
npm run build:all:prod     # Production builds
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

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
└── docs/            # Documentation
```

## 📚 Documentation

### General
- [README.md](./README.md) - This file
- [MIGRATION-GUIDE.md](../docs/MIGRATION-GUIDE.md)
- [TESTING-IMPROVEMENTS.md](../docs/TESTING-IMPROVEMENTS.md)
- [PLATFORM-COMPARISON.md](../docs/PLATFORM-COMPARISON.md) - iOS vs Android comparison

### iOS Build & Deploy
- [IOS-README.md](../docs/IOS-README.md) - Overview
- [IOS-QUICK-START.md](../docs/IOS-QUICK-START.md) - Quick start guide
- [IOS-BUILD-GUIDE.md](../docs/IOS-BUILD-GUIDE.md) - Complete guide
- [APP-STORE-CHECKLIST.md](../docs/APP-STORE-CHECKLIST.md) - Pre-publish checklist
- [IOS-SETUP-SUMMARY.md](../docs/IOS-SETUP-SUMMARY.md) - Setup summary
- [IOS-RESOURCES.md](../docs/IOS-RESOURCES.md) - Useful resources

### Android Build & Deploy
- [ANDROID-README.md](./ANDROID-README.md) - Overview
- [ANDROID-QUICK-START.md](../docs/ANDROID-QUICK-START.md) - Quick start guide
- [ANDROID-BUILD-GUIDE.md](../docs/ANDROID-BUILD-GUIDE.md) - Complete guide

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
- **iOS Build Help**: See [IOS-BUILD-GUIDE.md](../docs/IOS-BUILD-GUIDE.md)
- **Android Build Help**: See [ANDROID-BUILD-GUIDE.md](../docs/ANDROID-BUILD-GUIDE.md)
- **Expo Forums**: https://forums.expo.dev/
- **Platform Comparison**: See [PLATFORM-COMPARISON.md](../docs/PLATFORM-COMPARISON.md)

## 📄 License

Private - All rights reserved

---

**Version**: 1.0.0  
**Last Updated**: December 2024
