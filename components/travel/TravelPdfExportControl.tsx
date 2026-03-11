import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { Travel } from '@/types/types'
import { ExportStage } from '@/types/pdf-export'
import type { ShareButtonsPdfExportState } from '@/components/travel/ShareButtonsPdfExportBridge'

const ShareButtonsPdfExportBridgeLazy = lazy(() => import('@/components/travel/ShareButtonsPdfExportBridge'))

const INITIAL_PDF_EXPORT_STATE: ShareButtonsPdfExportState = {
  isGenerating: false,
  progress: 0,
  currentStage: ExportStage.ERROR,
  lastSettings: {
    title: 'Мои путешествия',
    subtitle: '',
    coverType: 'auto',
    template: 'minimal',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    includeChecklists: false,
    checklistSections: ['clothing', 'food', 'electronics'],
  },
}

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
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [shouldMountPdfExport, setShouldMountPdfExport] = useState(false)
  const [{ isGenerating }, setPdfExportState] = useState<ShareButtonsPdfExportState>(INITIAL_PDF_EXPORT_STATE)

  const handleOpenExport = useCallback(() => {
    if (Platform.OS !== 'web') {
      Alert.alert?.('Недоступно', 'Экспорт PDF доступен только в веб-версии')
      return
    }
    setShouldMountPdfExport(true)
    setShowSettingsModal(true)
  }, [])

  const buttonContent = useMemo(() => {
    if (isGenerating) {
      return <ActivityIndicator size="small" color={mutedText} />
    }

    return <Feather name="file-text" size={18} color={mutedText} />
  }, [isGenerating, mutedText])

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
        disabled={isGenerating}
        accessibilityRole="button"
        accessibilityLabel="Экспорт в PDF"
        ref={setWebTitle}
        style={({ pressed }) => [
          actionBtnStyle,
          pressed && !isGenerating ? actionBtnPressedStyle : null,
          isGenerating ? actionBtnDisabledStyle : null,
        ]}
        {...(Platform.OS === 'web'
          ? {
              'data-action-btn': true,
              'data-disabled': isGenerating ? 'true' : 'false',
              role: 'button',
              'aria-label': 'Экспорт в PDF',
            }
          : {})}
      >
        {buttonContent}
      </Pressable>

      {Platform.OS === 'web' && shouldMountPdfExport && (
        <Suspense fallback={null}>
          <ShareButtonsPdfExportBridgeLazy
            travel={travel}
            visible={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onStateChange={setPdfExportState}
          />
        </Suspense>
      )}
    </>
  )
}

export default React.memo(TravelPdfExportControl);
