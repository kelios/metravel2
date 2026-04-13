import React, { lazy } from 'react'

export const isHeaderMobileMenuTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

export const ThemeToggleLazy = lazy(() => import('@/components/layout/ThemeToggle'))

export const CustomHeaderMobileMenuComp = isHeaderMobileMenuTestEnv
  ? (require('./CustomHeaderMobileMenu').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderMobileMenu'))
