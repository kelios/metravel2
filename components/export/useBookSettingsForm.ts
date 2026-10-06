// components/export/useBookSettingsForm.ts
// #2229: логика формы «Настройки фотоальбома» без DOM — общая для окна сайта и
// нативного окна (`BookSettingsModal.native.tsx`). Проверки, премиум-гейты и
// сохранение живут здесь, чтобы правила не разъехались между платформами.
// Ловушка фокуса, Escape и блокировка прокрутки страницы — дело web-окна.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePdfPremium } from '@/hooks/usePdfPremium'
import { translate as i18nT } from '@/i18n'
import type { BookPreset } from '@/types/pdf-presets'
import { showToast } from '@/utils/toast'

import { DEFAULT_CHECKLIST_SELECTION } from './BookSettingsModal.constants'
import { buildInitialSettings } from './BookSettingsModal.helpers'
import { gallerySettingNeedsPremium, isPremiumCoverType } from './BookSettingsModal.premium'
import type { BookSettings, ChecklistSection } from './BookSettingsModal.types'

export const BOOK_SUBTITLE_MAX_LENGTH = 150

type UseBookSettingsFormOptions = {
  visible: boolean
  defaultSettings?: Partial<BookSettings>
  onSave: (settings: BookSettings) => void | Promise<void>
  onPreview?: (settings: BookSettings) => void | Promise<void>
  onClose: () => void
  loadSettings?: () => Partial<BookSettings> | undefined
  persistSettings?: (settings: BookSettings) => void
}

export function validateBookSettings(settings: BookSettings): string[] {
  const errors: string[] = []
  if (settings.subtitle && settings.subtitle.length > BOOK_SUBTITLE_MAX_LENGTH) {
    errors.push(i18nT('profile:components.export.BookSettingsModal.podzagolovok_ne_dolzhen_prevyshat_150_simvol_67705c6a'))
  }
  if (settings.includeChecklists && settings.checklistSections.length === 0) {
    errors.push(i18nT('profile:components.export.BookSettingsModal.vyberite_hotya_by_odin_razdel_chek_lista_ili_18ec07d4'))
  }
  return errors
}

export function useBookSettingsForm({ visible, defaultSettings, onSave, onPreview, onClose, loadSettings, persistSettings }: UseBookSettingsFormOptions) {
  const { isPremium, requireUnlock, trackPaywallView } = usePdfPremium()
  const [settings, setSettings] = useState<BookSettings>(() => buildInitialSettings(defaultSettings))
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Каждое открытие начинается с переданных настроек: правки закрытого окна отбрасываются.
  useEffect(() => {
    if (!visible) return
    setSettings(buildInitialSettings(defaultSettings ?? loadSettings?.()))
    setSelectedPresetId(undefined)
    setHasUnsavedChanges(false)
  }, [visible, defaultSettings, loadSettings])

  const validationErrors = useMemo(() => validateBookSettings(settings), [settings])

  const updateSettings = useCallback((updates: Partial<BookSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
    setHasUnsavedChanges(true)
  }, [])

  const selectPreset = useCallback((preset: BookPreset) => {
    setSettings((prev) => ({ ...preset.settings, title: prev.title, subtitle: prev.subtitle }))
    setSelectedPresetId(preset.id)
    setHasUnsavedChanges(true)
  }, [])

  const selectTheme = useCallback(
    (template: BookSettings['template']) => updateSettings({ template }),
    [updateSettings],
  )

  /** Журнальные раскладки, подписи поверх фото и full-bleed — премиум (#298). */
  const updateGallery = useCallback(
    (updates: Partial<BookSettings>) => {
      if (!isPremium && gallerySettingNeedsPremium(updates)) {
        trackPaywallView('gallery-premium')
        requireUnlock('gallery-premium')
        return
      }
      updateSettings(updates)
    },
    [isPremium, requireUnlock, trackPaywallView, updateSettings],
  )

  /** «Свое изображение» для обложки — премиум (#298). */
  const selectCoverType = useCallback(
    (coverType: BookSettings['coverType']) => {
      if (!isPremium && isPremiumCoverType(coverType)) {
        trackPaywallView('cover-custom')
        requireUnlock('cover-custom')
        return
      }
      updateSettings({ coverType })
    },
    [isPremium, requireUnlock, trackPaywallView, updateSettings],
  )

  const toggleChecklists = useCallback((enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      includeChecklists: enabled,
      checklistSections:
        enabled && prev.checklistSections.length === 0 ? DEFAULT_CHECKLIST_SELECTION : prev.checklistSections,
    }))
    setHasUnsavedChanges(true)
  }, [])

  const toggleChecklistSection = useCallback((section: ChecklistSection) => {
    setSettings((prev) => ({
      ...prev,
      checklistSections: prev.checklistSections.includes(section)
        ? prev.checklistSections.filter((item) => item !== section)
        : [...prev.checklistSections, section],
    }))
    setHasUnsavedChanges(true)
  }, [])

  const submit = useCallback(
    async (action: ((value: BookSettings) => void | Promise<void>) | undefined, errorKey: 'save' | 'preview') => {
      if (!action || isSaving || validationErrors.length > 0) return
      setIsSaving(true)
      try {
        if (errorKey === 'save') persistSettings?.(settings)
        await action(settings)
        if (!mountedRef.current) return
        setHasUnsavedChanges(false)
        setIsSaving(false)
        onClose()
      } catch {
        void showToast({
          type: 'error',
          text1:
            errorKey === 'save'
              ? i18nT('profile:components.export.BookSettingsModal.ne_udalos_sohranit_nastroyki_pdf_c17e83ed')
              : i18nT('profile:components.export.BookSettingsModal.ne_udalos_sozdat_prevyu_pdf_66bbe2ed'),
          position: 'bottom',
        })
        if (mountedRef.current) setIsSaving(false)
      }
    },
    [isSaving, onClose, persistSettings, settings, validationErrors.length],
  )

  const save = useCallback(() => submit(onSave, 'save'), [onSave, submit])
  const preview = useCallback(() => submit(onPreview, 'preview'), [onPreview, submit])

  return {
    settings,
    isPremium,
    selectedPresetId,
    isSaving,
    hasUnsavedChanges,
    validationErrors,
    hasSubtitleError: (settings.subtitle?.length ?? 0) > BOOK_SUBTITLE_MAX_LENGTH,
    updateSettings,
    selectPreset,
    selectTheme,
    updateGallery,
    selectCoverType,
    toggleChecklists,
    toggleChecklistSection,
    save,
    preview,
  }
}
