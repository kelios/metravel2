// components/travel/hooks/useSingleTravelExport.ts
// ✅ Хук для экспорта одного путешествия с поддержкой всех настроек

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Travel } from '@/types/types'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import { usePdfExport } from '@/hooks/usePdfExport'

const DEFAULT_CHECKLISTS: BookSettings['checklistSections'] = ['clothing', 'food', 'electronics']

export function buildDefaultSettingsForTravel(travel?: Travel): BookSettings {
  return {
    title: travel?.name ? `Путешествие: ${travel.name}` : 'Мои путешествия',
    subtitle: travel?.countryName || travel?.cityName || '',
    coverType: 'auto',
    template: 'minimal',
    sortOrder: 'date-desc',
    includeToc: true,
    includeGallery: true,
    includeMap: true,
    includeChecklists: false,
    checklistSections: DEFAULT_CHECKLISTS,
  }
}

export function useSingleTravelExport(travel?: Travel) {
  const travelsForExport = useMemo(() => (travel ? [travel] : []), [travel])
  const pdfExport = usePdfExport(travelsForExport)

  const baseSettings = useMemo(() => buildDefaultSettingsForTravel(travel), [travel])

  const [lastSettings, setLastSettings] = useState<BookSettings>(baseSettings)

  useEffect(() => {
    setLastSettings(baseSettings)
  }, [baseSettings])

  const settingsSummary = useMemo(() => {
    return `${lastSettings.template}`
  }, [lastSettings])

  const handleOpenPrintBookWithSettings = useCallback(
    async (settings: BookSettings) => {
      setLastSettings(settings)
      await pdfExport.openPrintBook(settings)
    },
    [pdfExport]
  )

  return {
    pdfExport,
    lastSettings,
    settingsSummary,
    handleOpenPrintBookWithSettings,
  }
}

export default useSingleTravelExport
