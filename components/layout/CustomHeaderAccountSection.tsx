import { Suspense } from 'react';
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
    // Мобильный бокс держит обёртка ниже (`rightSectionMobile`), поэтому пустой
    // fallback ничего не двигает.
    <Suspense fallback={null}>
      <CustomHeaderMobileAccountSectionComp activePath={activePath} styles={styles} />
    </Suspense>
  ) : (
    // #1298: у desktop-ветки собственной обёртки нет — бокс приносит сама
    // секция. С `fallback={null}` между двумя ленивыми загрузками (этой секции
    // и desktop-секции внутри) правый слот исчезал, и переключатель языка
    // уезжал вправо на 240 px, а затем возвращался. Fallback обязан занимать
    // тот же `rightSection` с зарезервированной шириной.
    <Suspense fallback={<View style={styles.rightSection} />}>
      <CustomHeaderDesktopAccountSectionComp styles={styles} />
    </Suspense>
  )

  return isMobile ? <View style={styles.rightSectionMobile}>{content}</View> : <>{content}</>
}
