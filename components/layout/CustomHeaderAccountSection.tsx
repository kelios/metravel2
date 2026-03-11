import React, { Suspense, lazy, useMemo } from 'react'
import { View } from 'react-native'

const isTestEnv = typeof process !== 'undefined' && process.env?.JEST_WORKER_ID !== undefined

const CustomHeaderDesktopAccountSectionComp = isTestEnv
  ? (require('./CustomHeaderDesktopAccountSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderDesktopAccountSection'))
const CustomHeaderMobileAccountSectionComp = isTestEnv
  ? (require('./CustomHeaderMobileAccountSection').default as React.ComponentType<any>)
  : lazy(() => import('./CustomHeaderMobileAccountSection'))

type CustomHeaderAccountSectionProps = {
  activePath: string;
  isMobile: boolean;
  styles: any;
};

export default function CustomHeaderAccountSection({
  activePath,
  isMobile,
  styles,
}: CustomHeaderAccountSectionProps) {
  const content = useMemo(() => {
    if (isMobile) {
      return (
        <Suspense fallback={null}>
          <CustomHeaderMobileAccountSectionComp activePath={activePath} styles={styles} />
        </Suspense>
      )
    }

    return (
      <Suspense fallback={null}>
        <CustomHeaderDesktopAccountSectionComp styles={styles} />
      </Suspense>
    )
  }, [activePath, isMobile, styles])

  return isMobile ? <View style={styles.rightSection}>{content}</View> : <>{content}</>
}
