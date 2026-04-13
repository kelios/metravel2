import React, { lazy } from 'react'

const isHeaderAccountTestEnv =
  typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

export const CustomHeaderDesktopAccountSectionComp = isHeaderAccountTestEnv
  ? (require('./CustomHeaderDesktopAccountSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderDesktopAccountSection'))

export const CustomHeaderMobileAccountSectionComp = isHeaderAccountTestEnv
  ? (require('./CustomHeaderMobileAccountSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderMobileAccountSection'))
