// Регрессия BE #293: premium-гейт PDF.
// Гейт OFF (по умолчанию) → все премиум. Гейт ON → читаем серверный is_premium из authStore.

describe('PdfEntitlementSource gate (BE #293)', () => {
  const ORIGINAL = process.env.EXPO_PUBLIC_PDF_PREMIUM_GATE

  afterEach(() => {
    process.env.EXPO_PUBLIC_PDF_PREMIUM_GATE = ORIGINAL
    jest.resetModules()
  })

  it('гейт OFF: все премиум независимо от authStore', () => {
    jest.isolateModules(() => {
      delete process.env.EXPO_PUBLIC_PDF_PREMIUM_GATE
      const { activePdfEntitlementSource } = require('@/services/pdf-export/entitlement/PdfEntitlementSource')
      const { useAuthStore } = require('@/stores/authStore')
      useAuthStore.setState({ isPremium: false })
      expect(activePdfEntitlementSource.getIsPremium()).toBe(true)
    })
  })

  it('гейт ON: отражает authStore.isPremium = true', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_PDF_PREMIUM_GATE = 'true'
      const { activePdfEntitlementSource } = require('@/services/pdf-export/entitlement/PdfEntitlementSource')
      const { useAuthStore } = require('@/stores/authStore')
      useAuthStore.setState({ isPremium: true })
      expect(activePdfEntitlementSource.getIsPremium()).toBe(true)
    })
  })

  it('гейт ON: отражает authStore.isPremium = false', () => {
    jest.isolateModules(() => {
      process.env.EXPO_PUBLIC_PDF_PREMIUM_GATE = 'true'
      const { activePdfEntitlementSource } = require('@/services/pdf-export/entitlement/PdfEntitlementSource')
      const { useAuthStore } = require('@/stores/authStore')
      useAuthStore.setState({ isPremium: false })
      expect(activePdfEntitlementSource.getIsPremium()).toBe(false)
    })
  })
})
