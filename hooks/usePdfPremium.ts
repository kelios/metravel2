// hooks/usePdfPremium.ts
// Хук доступа к премиум-PDF: статус + аналитика paywall (FE-8.2 / #294)

import { useCallback } from 'react'

import { activePdfEntitlementSource } from '@/services/pdf-export/entitlement/PdfEntitlementSource'
import { useAuthStore } from '@/stores/authStore'
import { queueAnalyticsEvent } from '@/utils/analytics'

interface UsePdfPremiumResult {
  isPremium: boolean
  requireUnlock: (context?: string) => void
  trackPaywallView: (context?: string) => void
}

export function usePdfPremium(): UsePdfPremiumResult {
  // Реактивно: при гейте OFF стаб всегда true; при ON следим за authStore.isPremium
  // (профиль грузится в фоне после логина). Селектор ре-выполняется на любое изменение стора.
  const isPremium = useAuthStore(() => activePdfEntitlementSource.getIsPremium())

  const requireUnlock = useCallback((context?: string) => {
    queueAnalyticsEvent('Premium_Unlock_Click', { context })
    // TODO(FE-8 / #296): здесь будет переход в checkout. Реальной оплаты пока
    // нет — ведём на «скоро/waitlist».
  }, [])

  const trackPaywallView = useCallback((context?: string) => {
    queueAnalyticsEvent('Premium_Paywall_View', { context })
  }, [])

  return { isPremium, requireUnlock, trackPaywallView }
}
