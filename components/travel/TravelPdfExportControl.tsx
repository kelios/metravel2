import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { Travel } from '@/types/types'
import { ExportStage } from '@/types/pdf-export'
import type { ShareButtonsPdfExportState } from '@/components/travel/ShareButtonsPdfExportBridge'
import { translate as i18nT } from '@/i18n'
import { webTitleRef } from '@/utils/webProps'


const ShareButtonsPdfExportBridgeLazy = lazy(() => import('@/components/travel/ShareButtonsPdfExportBridge'))

const INITIAL_PDF_EXPORT_STATE: ShareButtonsPdfExportState = {
  isGenerating: false,
  progress: 0,
  currentStage: ExportStage.ERROR,
  lastSettings: {
    get title() { return i18nT('travel:components.travel.pdfExport.defaultBookTitle') },
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
  /** Вид под курсором мыши (web, #2036); на native и на касание `hovered` не приходит. */
  actionBtnHoveredStyle?: StyleProp<ViewStyle>
  actionBtnPressedStyle: any
  actionBtnDisabledStyle: any
}

function TravelPdfExportControl({
  travel,
  mutedText,
  actionBtnStyle,
  actionBtnHoveredStyle,
  actionBtnPressedStyle,
  actionBtnDisabledStyle,
}: Props) {
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [shouldMountPdfExport, setShouldMountPdfExport] = useState(false)
  const [{ isGenerating, cancel }, setPdfExportState] = useState<ShareButtonsPdfExportState>(INITIAL_PDF_EXPORT_STATE)

  const handleOpenExport = useCallback(() => {
    setShouldMountPdfExport(true)
    setShowSettingsModal(true)
  }, [])

  // #2274: на время сборки нажатие отменяет её — лист печати не откроется.
  const label = isGenerating
    ? i18nT('shared:components.ui.ProgressIndicator.otmenit_ac1629b1')
    : i18nT('travel:components.travel.TravelPdfExportControl.eksport_v_pdf_94c24fb3')

  const buttonContent = useMemo(() => {
    if (isGenerating) {
      return <ActivityIndicator size="small" color={mutedText} />
    }

    return <Feather name="file-text" size={18} color={mutedText} />
  }, [isGenerating, mutedText])

  return (
    <>
      <Pressable
        onPress={isGenerating ? () => cancel?.() : handleOpenExport}
        accessibilityRole="button"
        accessibilityLabel={label}
        ref={webTitleRef(label)}
        style={({ pressed, hovered }) => [
          actionBtnStyle,
          hovered && !isGenerating ? actionBtnHoveredStyle : null,
          pressed && !isGenerating ? actionBtnPressedStyle : null,
          isGenerating ? actionBtnDisabledStyle : null,
        ]}
        {...(Platform.OS === 'web'
          ? {
              role: 'button',
              'aria-label': label,
            }
          : {})}
      >
        {buttonContent}
      </Pressable>

      {shouldMountPdfExport && (
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
