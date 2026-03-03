# 📱 Android & Mobile — Нереализованные задачи

> **Обновлено:** Март 2026  
> **Платформа:** Android (Expo + React Native)

---

## 🔴 P0 — Критичные

### AND-01 | Android App Links — верификация

**Статус:** Частично. `public/.well-known/assetlinks.json` создан (шаблон).

**Оставшиеся действия:**
1. Заменить SHA-256 fingerprint в `assetlinks.json` на реальный из release keystore
2. Проверить доступность на prod: `https://metravel.by/.well-known/assetlinks.json`
3. Протестировать deep links: `adb shell am start -a android.intent.action.VIEW -d "https://metravel.by/travels/test"`

---

### AND-03 | Google Sign-In на Android native

**Статус:** Код готов (`GoogleSignInButton.native.tsx` + `expo-auth-session`), нет Android Client ID.

**Оставшиеся действия:**
1. Создать Android OAuth Client ID в Google Cloud Console
2. Добавить SHA-1 fingerprint debug/release keystore в Cloud Console
3. Настроить `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` в `.env`

---

## 🟠 P1

### AND-05 | Push-уведомления

**Статус:** Код готов (`services/notifications.ts`, `hooks/usePushNotifications.ts`, `expo-notifications`). Нужна инфраструктура.

**Оставшиеся действия:**
1. Настроить `google-services.json` (FCM)
2. Реализовать бэкенд endpoint `POST /api/user/push-token/`
3. Проверить на реальном устройстве

---

## 🟢 P3 — Nice to have

| ID | Задача | Описание |
|----|--------|----------|
| AND-19 | Android App Widget | Widget со случайным маршрутом дня (native Kotlin) |
| AND-21 | Picture-in-Picture | PiP мини-карта при переходе на другой экран |
| AND-22 | GPS tracking | Запись GPS-трека, генерация GPX (фоновая геолокация) |
| AND-25 | Performance monitoring | Код готов (`services/performanceMonitoring.ts`), нужен `@sentry/react-native` + `EXPO_PUBLIC_SENTRY_DSN` |

