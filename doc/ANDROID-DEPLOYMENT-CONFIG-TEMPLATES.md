# 📝 Android Deploy - Configuration Templates

## app.json - Полный пример для production

Используйте этот файл как шаблон для обновления вашего `app.json`:

```json
{
  "expo": {
    "owner": "savran.juli",
    "name": "MeTravel",
    "slug": "metravel",
    "version": "1.0.0",
    "description": "Discover and share travel experiences",
    "privacy": "https://metravel.by/privacy",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.metravel.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "This app uses your location to provide personalized travel recommendations.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Allow $(PRODUCT_NAME) to use your location.",
        "NSPhotoLibraryUsageDescription": "This app needs access to your photo library to upload travel photos.",
        "NSPhotoLibraryAddUsageDescription": "This app needs permission to save photos to your library.",
        "NSCameraUsageDescription": "This app needs access to your camera to take travel photos.",
        "NSMicrophoneUsageDescription": "This app needs access to your microphone for video recording.",
        "UIBackgroundModes": ["location"],
        "ITSAppUsesNonExemptEncryption": false
      },
      "config": {
        "googleMapsApiKey": "AIzaSy..."  // ← ВАШ КЛЮЧ
      },
      "usesAppleSignIn": false,
      "associatedDomains": ["applinks:metravel.by"]
    },
    
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.metravel.app",  // ← ИЗМЕНИТЕ НА УНИКАЛЬНОЕ ИМЯ
      "versionCode": 1,
      "minSdkVersion": 24,             // ← Android 7.0
      "targetSdkVersion": 35,          // ← ТРЕБУЕТСЯ Google Play (35+)
      "compileSdkVersion": 35,
      "privacyUrl": "https://metravel.by/privacy",  // ← ДОБАВЬТЕ URL
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
        "READ_MEDIA_VIDEO",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "INTERNET"
      ],
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSy..."  // ← ВАШ GOOGLE MAPS KEY
        }
      },
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "metravel.by",
              "pathPrefix": "/"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ],
      "blockedPermissions": ["android.permission.RECORD_AUDIO"]
    },
    
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location."
        }
      ],
      "expo-secure-store"
    ],
    
    "experiments": {
      "tsconfigPaths": true,
      "typedRoutes": true
    },
    
    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "472c9f49-998e-43c5-bf37-0478cf259645"
      }
    },
    
    "runtimeVersion": {
      "policy": "sdkVersion"
    }
  }
}
```

---

## .env.prod - Переменные окружения

Создайте файл `.env.prod` в корне проекта:

```bash
# Production Environment Variables
NODE_ENV=production
EXPO_PUBLIC_API_URL=https://api.metravel.by
EXPO_PUBLIC_APP_NAME=MeTravel
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_ENVIRONMENT=production

# Analytics (если используется Firebase)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Другие сервисы
EXPO_PUBLIC_SENTRY_DSN=

# Не забудьте добавить в .gitignore!
```

**Используйте в коде:**
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL;
```

---

## android/build.gradle - Проверка конфигурации

Убедитесь что в `android/build.gradle` установлены правильные версии:

```groovy
// Top-level build file
buildscript {
    ext {
        buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
        minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
        compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '35')
        targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')  // ← 35!
        kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'
        ndkVersion = "26.1.10909125"
    }
    // ...
}
```

---

## eas.json - Полная конфигурация

Ваш `eas.json` уже хорошо настроен. Вот полный пример с комментариями:

```json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "node": "20.19.4",
      "ios": {
        "simulator": true,
        "buildConfiguration": "Debug"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    
    "preview": {
      "distribution": "internal",
      "node": "20.19.4",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    },
    
    "production": {
      "distribution": "store",
      "node": "20.19.4",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release",
        "autoIncrement": true
      },
      "android": {
        "buildType": "app-bundle",
        "autoIncrement": true
      }
    }
  },
  
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "your-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"  // Начните с internal, потом alpha → beta → production
      }
    }
  }
}
```

---

## google-services.json - Пример структуры

Если вы используете Firebase, скачайте этот файл из Firebase Console.
Он будет похож на это:

```json
{
  "type": "service_account",
  "project_id": "metravel-xxxxx",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----...",
  "client_email": "firebase-adminsdk-xxxxx@metravel-xxxxx.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
}
```

**Положить в:** корень проекта (`/metravel2/google-services.json`)
**Добавить в .gitignore:** уже добавлено ✅

---

## Privacy Policy - Минимальный пример

Создайте файл `docs/privacy-policy.md`:

```markdown
# Privacy Policy for MeTravel

**Last Updated:** December 29, 2025

## Introduction
MeTravel ("we," "us," "our," or "App") is committed to protecting your privacy. 
This Privacy Policy explains our practices regarding the collection, use, and 
disclosure of information when you use our mobile application and related services.

## Information We Collect

### Location Information
- We collect precise location data when you enable location services
- This is used to show travel destinations near you
- You can disable this in app settings

### Photos and Media
- When you upload travel photos, we store them on our servers
- You control which photos are public or private

### Personal Information
- Email address (for login)
- Username and profile information
- Travel preferences and favorites

### Device Information
- Device type and operating system
- App version and crash reports
- IP address and usage analytics

## How We Use Information

We use collected information to:
- Provide and improve the App
- Show personalized travel recommendations
- Communicate with you about updates
- Monitor app performance and security

## Data Sharing

We do **not** sell your personal data. We may share data with:
- Service providers (cloud hosting, analytics)
- Law enforcement if required by law

## Your Rights

You can:
- Access your personal data
- Request deletion of your account
- Opt-out of location tracking
- Disable analytics

## Contact Us

For privacy concerns, contact: privacy@metravel.by

## Changes to This Policy

We may update this policy. We'll notify you of major changes via the App.
```

**URL:** https://metravel.by/privacy (обновите в app.json)

---

## Google Play Console - Store Listing Template

### App Name (max 50 chars)
```
MeTravel
```

### Short Description (max 80 chars)
```
Discover travel experiences, share moments, explore the world
```

### Full Description (max 4000 chars)
```
MeTravel is your personal travel companion for discovering and sharing 
amazing travel experiences. Whether you're a seasoned traveler or just 
starting your journey, MeTravel helps you explore destinations, save your 
favorites, and connect with other travelers around the world.

FEATURES:
• Discover travel destinations around you
• Save your favorite places and experiences  
• Share your travel photos and stories
• Real-time location tracking and maps
• Personalized travel recommendations
• Connect with other travel enthusiasts
• Create travel guides and tips
• Explore trending destinations
• Weather forecasts for your travels
• Offline map support

WHY METRAVEL?
• Curated travel recommendations
• User-friendly interface
• Privacy-focused design
• No ads (ad-free experience)
• Regular updates with new features

Start exploring the world with MeTravel today!

Privacy Policy: https://metravel.by/privacy
Terms of Service: https://metravel.by/terms
```

### Screenshots (5-8 штук)

**Размер:** 1080 x 1920 px для 5.5" экранов

Скриншоты должны показывать:
1. **Home screen** - основной экран с рекомендациями
2. **Travel Discovery** - список путешествий и мест
3. **Map View** - карта с точками интереса
4. **Travel Details** - подробная информация о месте
5. **User Profile** - профиль пользователя
6. **Photo Gallery** - галерея фото (опционально)
7. **Favorites** - сохранённые места (опционально)
8. **Settings** - настройки приложения (опционально)

### Categorization
- **Category:** Travel
- **Content rating:** Moderate (или ниже, в зависимости от контента)
- **Target audience:** Everyone / Teens / Mature users

---

## Google Cloud Console - API Key Setup

### Шаги для получения Google Maps API Key:

1. **Перейти на:** https://console.cloud.google.com/

2. **Создать новый проект:**
   ```
   Project Name: MeTravel
   Billing Account: [Выберите аккаунт]
   ```

3. **Включить APIs:**
   - Перейти на "APIs & Services" → "Library"
   - Найти и включить:
     - Maps SDK for Android
     - Maps SDK for iOS
     - Places API (опционально)

4. **Создать API Key:**
   - Перейти на "APIs & Services" → "Credentials"
   - Create Credentials → API Key
   - Тип: API Key

5. **Ограничить ключ:**
   - Ограничение API:
     - Maps SDK for Android
     - Maps SDK for iOS
   - Ограничение платформы:
     - Android: Добавить SHA-1 fingerprint (от EAS)
     - iOS: Bundle IDs

6. **Получить SHA-1 fingerprint для Android:**
   ```bash
   # После первой сборки с EAS, он покажет SHA-1
   # Или вручную:
   eas build:view --platform android
   # Найти "SHA-1" в выводе
   ```

7. **Добавить в app.json:**
   ```json
   "config": {
     "googleMaps": {
       "apiKey": "AIzaSy..."
     }
   }
   ```

---

## .gitignore - Конфиденциальные файлы

Убедитесь что в `.gitignore` есть эти строки:

```bash
# Environment variables
.env
.env.local
.env.prod
.env.production
.env.*.local

# Google Services
google-services.json
google-play-service-account.json

# Android keystore
android-keystore.jks
android/app/release/

# EAS
.eas/

# Node
node_modules/
npm-debug.log

# Expo
.expo/
dist/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Build
android/app/build/
ios/Pods/
```

---

## Commands - Готовые команды для выполнения

### 1. Проверка конфигурации
```bash
npm run android:prebuild
```

### 2. Сборка для тестирования
```bash
npm run android:build:preview
```

### 3. Сборка для продакшена
```bash
npm run android:build:prod
```

### 4. Отправка в Play Store
```bash
npm run android:submit:latest
```

### 5. Проверка статуса сборок
```bash
eas build --status --platform android
```

### 6. Просмотр последней сборки
```bash
eas build:view
```

### 7. Очистка кэша перед сборкой
```bash
npm run clean
eas build --platform android --profile production --clear-cache
```

---

## Troubleshooting - Решение частых проблем

### Ошибка: "package name mismatch"
```bash
# Убедиться что package одинаков везде:
grep -r "com.yourcompany.metravel" .
# Заменить везде на ваше имя пакета
```

### Ошибка: "Google Maps API Key not found"
```bash
# Убедиться что ключ добавлен в app.json
# Перестроить сборку
npm run clean
npm run android:build:prod --clear-cache
```

### Ошибка: "targetSdkVersion too low"
```bash
# Обновить в android/build.gradle
targetSdkVersion = 35
```

### Ошибка: "gradle build failed"
```bash
# Очистить gradle кэш
rm -rf android/.gradle
rm -rf android/app/build
npm install
npm run android:build:preview
```

### Ошибка: "EAS Build timeout"
```bash
# Это может случиться при большом размере
# Решение: удалить ненужные зависимости
npm audit
npm prune
```

---

## Resources - Полезные ресурсы

### Официальная документация
- **Expo Docs:** https://docs.expo.dev/
- **EAS Build:** https://docs.expo.dev/build/overview/
- **EAS Submit:** https://docs.expo.dev/submit/overview/
- **app.json reference:** https://docs.expo.dev/versions/latest/config/app/

### Google Services
- **Google Cloud Console:** https://console.cloud.google.com/
- **Google Play Console:** https://play.google.com/console/
- **Firebase Console:** https://console.firebase.google.com/
- **Google Maps Platform:** https://cloud.google.com/maps-platform/

### Android Development
- **Android Studio:** https://developer.android.com/studio/
- **Android App Bundle:** https://developer.android.com/guide/app-bundle/
- **Android Permissions:** https://developer.android.com/guide/topics/permissions

### Best Practices
- **Google Play Policy:** https://support.google.com/googleplay/android-developer/answer/9859455
- **App Quality Guidelines:** https://support.google.com/googleplay/android-developer/answer/7639559
- **Privacy Policy Guide:** https://support.google.com/googleplay/android-developer/answer/10787469

---

## Checklist перед первой сборкой

- [ ] app.json обновлен (package name, privacy, targetSdkVersion)
- [ ] .env.prod создан
- [ ] Google Maps API Key получен
- [ ] google-services.json скачан (если используется Firebase)
- [ ] eas.json проверен и правильно настроен
- [ ] .gitignore содержит конфиденциальные файлы
- [ ] README.md обновлен с инструкциями
- [ ] Все тесты проходят: `npm run test:run`
- [ ] Линтер проходит: `npm run lint`
- [ ] Prebuild проверка прошла: `npm run android:prebuild`

---

**Последнее обновление:** 29 декабря 2025

