import React, { Suspense } from 'react'
import { View } from 'react-native'
import {
  CustomHeaderDesktopAccountSectionComp,
  CustomHeaderMobileAccountSectionComp,
} from './customHeaderAccountLazy'

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
  const content = isMobile ? (
    <Suspense fallback={null}>
      <CustomHeaderMobileAccountSectionComp activePath={activePath} styles={styles} />
    </Suspense>
  ) : (
    <Suspense fallback={null}>
      <CustomHeaderDesktopAccountSectionComp styles={styles} />
    </Suspense>
  )

  return isMobile ? <View style={styles.rightSection}>{content}</View> : <>{content}</>
}
