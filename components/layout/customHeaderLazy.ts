import React, { lazy } from 'react'

import { isHeaderTestEnv } from './customHeaderModel'

export const HeaderContextBarLazy = lazy(() => import('./HeaderContextBar'))

export const CustomHeaderNavSectionComp = isHeaderTestEnv
  ? (require('./CustomHeaderNavSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderNavSection'))

export const CustomHeaderAccountSectionComp = isHeaderTestEnv
  ? (require('./CustomHeaderAccountSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderAccountSection'))
