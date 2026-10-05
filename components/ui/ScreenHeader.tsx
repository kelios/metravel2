import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { useIsScreenHeaderMobile, type ScreenHeaderAction, type ScreenHeaderConfig } from '@/components/layout/ScreenHeaderContext'
import { headingLevel1Props, SCREEN_HEADER_DESKTOP_PROPS } from '@/utils/webProps'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

type Props = {
  header: ScreenHeaderConfig
  testID?: string
}

/**
 * Desktop-представление декларации `useScreenHeader` (#2099): H1, описание и
 * кнопки с подписями в теле страницы. На телефоне ничего не рисует — заголовок,
 * (i) и иконки там живут в строке `HeaderContextBar`.
 */
function ScreenHeader({ header, testID }: Props) {
  const isMobile = useIsScreenHeaderMobile()
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  if (isMobile) return null

  const description = header.info?.[0]
  const buttons: Array<{ action: ScreenHeaderAction; primary: boolean }> = [
    ...(header.actions ?? []).map((action) => ({ action, primary: false })),
    ...(header.primaryAction ? [{ action: header.primaryAction, primary: true }] : []),
  ]

  return (
    <View style={styles.header} testID={testID ?? 'screen-header'} {...SCREEN_HEADER_DESKTOP_PROPS}>
      <View style={styles.copy}>
        <Text
          style={styles.h1}
          {...headingLevel1Props()}
        >
          {header.title}
        </Text>
        {description ? <Text style={styles.lead}>{description}</Text> : null}
      </View>
      {buttons.length ? (
        <View style={styles.actions}>
          {buttons.map(({ action, primary }) => (
            <Button
              key={`${action.icon}-${action.label}`}
              label={action.label}
              size="sm"
              variant={primary ? 'primary' : 'secondary'}
              onPress={action.onPress}
              disabled={action.disabled}
              icon={<Feather name={action.icon} size={16} color={primary ? colors.textOnPrimary : colors.primaryDark} />}
              testID={action.testID}
            />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 14,
    },
    copy: { flex: 1, minWidth: 240, gap: 5 },
    h1: { fontSize: 28, fontWeight: '900', color: colors.text },
    lead: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
    actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  })

export default React.memo(ScreenHeader)
