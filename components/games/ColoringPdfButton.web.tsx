import { useState } from 'react'
import { View } from 'react-native'

import Button from '@/components/ui/Button'
import { Body } from '@/components/ui/Typography'
import { useTranslation } from '@/i18n/LocaleProvider'
import { startBrowserFileDownload } from '@/utils/externalLinks'

export default function ColoringPdfButton({ url, collection = false }: { url: string; collection?: boolean }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const label = collection ? t('gamesStatic:downloadBook') : t('gamesStatic:downloadSheet')

  function download() {
    setFailed(!startBrowserFileDownload(new URL(url, window.location.origin).href))
  }

  return (
    <View>
      <Button label={label} onPress={download} />
      {failed && <Body accessibilityRole="alert">{t('gamesStatic:pdfError')}</Body>}
    </View>
  )
}
