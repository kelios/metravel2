// services/pdf-export/entitlement/PdfEntitlementSource.ts
// Источник entitlement для премиум-PDF (FE-8.2 / #294)

export interface PdfEntitlementSource {
  getIsPremium(): boolean
}

// СЕЙЧАС все пользователи премиум — заглушка на время раскатки фичи.
export const stubAllPremiumSource: PdfEntitlementSource = {
  getIsPremium: () => true,
}

// TODO(FE-8 / BE #293): заменить на источник, читающий серверный user.is_premium = (опубликовано>=20 путешествий) OR (оплачено). Порог считает бэкенд, фронт только читает.
export const activePdfEntitlementSource: PdfEntitlementSource = stubAllPremiumSource
