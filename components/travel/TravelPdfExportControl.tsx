import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { Travel } from '@/types/types'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import useSingleTravelExportDefault, {
  useSingleTravelExport as useSingleTravelExportNamed,
} from '@/components/travel/hooks/useSingleTravelExport'

const BookSettingsModalLazy = lazy(() => import('@/components/export/BookSettingsModal'))

type Props = {
  travel: Travel
  mutedText: string
  actionBtnStyle: any
  actionBtnPressedStyle: any
  actionBtnDisabledStyle: any
}

function TravelPdfExportControl({
  travel,
  mutedText,
  actionBtnStyle,
  actionBtnPressedStyle,
  actionBtnDisabledStyle,
}: Props) {
  const useSingleTravelExport =
    useSingleTravelExportNamed ?? useSingleTravelExportDefault

  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const { pdfExport, lastSettings, handleOpenPrintBookWithSettings } = useSingleTravelExport(travel)

  const handleOpenExport = useCallback(() => {
    if (Platform.OS !== 'web') {
      Alert.alert?.('Недоступно', 'Экспорт PDF доступен только в веб-версии')
      return
    }
    setShowSettingsModal(true)
  }, [])

  const handleSaveSettings = useCallback(
    async (settings: BookSettings) => {
      await handleOpenPrintBookWithSettings(settings)
      setShowSettingsModal(false)
    },
    [handleOpenPrintBookWithSettings]
  )

  const handlePreviewSettings = useCallback(
    async (settings: BookSettings) => {
      await handleOpenPrintBookWithSettings(settings)
      setShowSettingsModal(false)
    },
    [handleOpenPrintBookWithSettings]
  )

  const buttonContent = useMemo(() => {
    if (pdfExport.isGenerating) {
      return <ActivityIndicator size="small" color={mutedText} />
    }

    return <Feather name="file-text" size={18} color={mutedText} />
  }, [mutedText, pdfExport.isGenerating])

  const setWebTitle = useCallback((el: any) => {
    if (Platform.OS === 'web' && el) {
      const node = el instanceof HTMLElement ? el : el._nativeTag ?? el
      if (node?.setAttribute) node.setAttribute('title', 'Экспорт в PDF')
    }
  }, [])

  return (
    <>
      <Pressable
        onPress={handleOpenExport}
        disabled={pdfExport.isGenerating}
        accessibilityRole="button"
        accessibilityLabel="Экспорт в PDF"
        ref={setWebTitle}
        style={({ pressed }) => [
          actionBtnStyle,
          pressed && !pdfExport.isGenerating ? actionBtnPressedStyle : null,
          pdfExport.isGenerating ? actionBtnDisabledStyle : null,
        ]}
        {...(Platform.OS === 'web'
          ? {
              'data-action-btn': true,
              'data-disabled': pdfExport.isGenerating ? 'true' : 'false',
              role: 'button',
              'aria-label': 'Экспорт в PDF',
            }
          : {})}
      >
        {buttonContent}
      </Pressable>

      {Platform.OS === 'web' && (
        <Suspense fallback={null}>
          <BookSettingsModalLazy
            visible={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onSave={handleSaveSettings}
            onPreview={handlePreviewSettings}
            defaultSettings={lastSettings}
            travelCount={1}
            userName={(travel as any)?.userName || (travel as any)?.user?.name || ''}
          />
        </Suspense>
      )}
    </>
  )
}

export default React.memo(TravelPdfExportControl);
