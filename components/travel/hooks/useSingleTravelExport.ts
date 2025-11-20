// components/travel/hooks/useSingleTravelExport.ts
// ✅ Хук для экспорта одного путешествия с поддержкой всех настроек

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Travel } from '@/src/types/types'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import { usePdfExport } from '@/src/hooks/usePdfExport'

const DEFAULT_CHECKLISTS: BookSettings['checklistSections'] = ['clothing', 'food', 'electronics']

export function buildDefaultSettingsForTravel(travel?: Travel): BookSettings {
  return {
    title: travel?.name ? `Путешествие: ${travel.name}` : 'Мои путешествия',
    subtitle: travel?.countryName || travel?.cityName || '',
    coverType: 'auto',
    template: 'classic',
    format: 'A4',
    orientation: 'portrait',
    margins: 'standard',
    imageQuality: 'high',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    colorTheme: 'blue',
    fontFamily: 'sans',
    photoMode: 'gallery',
    mapMode: 'full-page',
    includeChecklists: false,
    checklistSections: DEFAULT_CHECKLISTS,
  }
}

export function useSingleTravelExport(travel?: Travel) {
  const travelsForExport = useMemo(() => (travel ? [travel] : []), [travel])
  const pdfExport = usePdfExport(travelsForExport)

  const baseSettings = useMemo(() => buildDefaultSettingsForTravel(travel), [
    travel?.id,
    travel?.name,
    travel?.countryName,
    travel?.cityName,
  ])

  const [lastSettings, setLastSettings] = useState<BookSettings>(baseSettings)

  useEffect(() => {
    setLastSettings(baseSettings)
  }, [baseSettings])

  const settingsSummary = useMemo(() => {
    const orientation = lastSettings.orientation === 'landscape' ? 'Альбомная' : 'Книжная'
    const format = lastSettings.format?.toUpperCase?.() || 'A4'
    return `${format} • ${orientation} • ${lastSettings.template}`
  }, [lastSettings])

  const handleSaveWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings)
      await pdfExport.exportPdf(settings)
    },
    [pdfExport]
  )

  const handlePreviewWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings)
      await pdfExport.previewPdf(settings)
    },
    [pdfExport]
  )

  return {
    pdfExport,
    lastSettings,
    settingsSummary,
    handleSaveWithSettings,
    handlePreviewWithSettings,
  }
}

