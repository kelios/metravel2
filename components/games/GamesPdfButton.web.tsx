import { useState } from 'react'
import { View } from 'react-native'

import Button from '@/components/ui/Button'
import { Body } from '@/components/ui/Typography'
import { useTranslation } from '@/i18n/LocaleProvider'
import { startBrowserFileDownload } from '@/utils/externalLinks'

export default function GamesPdfButton({ url, label, variant }: { url: string; label: string; variant?: 'primary' | 'outline' }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  function download() {
    setFailed(!startBrowserFileDownload(new URL(url, window.location.origin).href))
  }

  return (
    <View>
      <Button label={label} variant={variant} onPress={download} />
      {failed && <Body accessibilityRole="alert">{t('gamesStatic:pdfError')}</Body>}
    </View>
  )
}
