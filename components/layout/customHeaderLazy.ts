import React from 'react'

import { isHeaderTestEnv } from './customHeaderModel'
import { safeLazy } from './safeLazy'

export const HeaderContextBarLazy = safeLazy(() => import('./HeaderContextBar'), 'HeaderContextBar', {
  retries: 2,
})

export const CustomHeaderNavSectionComp = isHeaderTestEnv
  ? (require('./CustomHeaderNavSection').default as React.ComponentType<any>)
  : safeLazy(() => import('./CustomHeaderNavSection'), 'CustomHeaderNavSection', { retries: 2 })

export const CustomHeaderAccountSectionComp = isHeaderTestEnv
  ? (require('./CustomHeaderAccountSection').default as React.ComponentType<any>)
  : safeLazy(() => import('./CustomHeaderAccountSection'), 'CustomHeaderAccountSection', {
      retries: 2,
    })
