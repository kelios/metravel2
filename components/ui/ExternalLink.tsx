// ✅ УЛУЧШЕНИЕ: Компонент для внешних ссылок с улучшенной доступностью
import { Link } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import React from 'react'
import { Platform } from 'react-native'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { webAccessibilityProps } from '@/utils/webProps'


export function ExternalLink(
  props: Omit<React.ComponentProps<typeof Link>, 'href'> & {
    href: string;
    children?: React.ReactNode;
  },
) {
  const colors = useThemedColors();

  return (
    <Link
      hrefAttrs={{
        // ✅ УЛУЧШЕНИЕ: На web открываем в новой вкладке
        target: '_blank',
        rel: 'noopener noreferrer', // ✅ БЕЗОПАСНОСТЬ: Защита от tabnabbing
      }}
      {...props}
      // @ts-expect-error: External URLs are not typed.
      href={props.href}
      style={[
        {
          color: colors.primaryText,
          textDecorationLine: 'underline',
        },
        props.style,
      ]}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          // ✅ На мобильных открываем в браузере приложения
          e?.preventDefault?.()
          WebBrowser.openBrowserAsync(props.href as string)
        }
      }}
      accessibilityRole="link"
      accessibilityHint={i18nT('shared:components.ui.ExternalLink.otkryvaet_vneshnyuyu_ssylku_9f2f78de')}
      {...(Platform.OS === 'web' ? webAccessibilityProps({
        'aria-label': i18nT('shared:components.ui.ExternalLink.pereyti_po_ssylke_value1_b03ad8f1', { value1: props.href }),
      }) : {})}
    />
  )
}
