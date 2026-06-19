// services/pdf-export/entitlement/PdfEntitlementSource.ts
// Источник entitlement для премиум-PDF (FE-8.2 / #294, #293)

import { useAuthStore } from '@/stores/authStore'

export interface PdfEntitlementSource {
  getIsPremium(): boolean
}

// Фиче-гейт раскатки paywall. Пока чекаут (#296) не готов — гейт ВЫКЛЮЧЕН: все пользователи
// считаются премиум (не отбираем функции без возможности оплатить). Владелец включает
// EXPO_PUBLIC_PDF_PREMIUM_GATE=true, когда появится реальный путь разблокировки.
export const PDF_PREMIUM_GATE_ENABLED =
  String(process.env.EXPO_PUBLIC_PDF_PREMIUM_GATE || '').trim().toLowerCase() === 'true'

// Заглушка на время раскатки: все премиум.
export const stubAllPremiumSource: PdfEntitlementSource = {
  getIsPremium: () => true,
}

// Реальный источник: серверный user.is_premium из профиля (BE #293), кэшируется в authStore.
// Читаем синхронно через getState() — работает и вне React (usePdfExportRuntime).
export const authStorePdfEntitlementSource: PdfEntitlementSource = {
  getIsPremium: () => useAuthStore.getState().isPremium,
}

export const activePdfEntitlementSource: PdfEntitlementSource = PDF_PREMIUM_GATE_ENABLED
  ? authStorePdfEntitlementSource
  : stubAllPremiumSource
