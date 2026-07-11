import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { updateGalleryCaption } from '@/api/misc'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface GalleryCaptionEditorProps {
  imageId: string
  caption: string
  disabled?: boolean
  onCaptionChange: (caption: string) => void
}

export function GalleryCaptionEditor({
  imageId,
  caption,
  disabled = false,
  onCaptionChange,
}: GalleryCaptionEditorProps) {
  const colors = useThemedColors()
  const styles = createStyles(colors)
  const persistedCaptionRef = useRef(String(caption ?? '').trim())
  const currentCaptionRef = useRef(caption)
  const requestVersionRef = useRef(0)
  const [status, setStatus] = useState<SaveStatus>('idle')

  currentCaptionRef.current = caption

  const persistCaption = useCallback(async () => {
    if (disabled || !/^\d+$/.test(imageId)) return

    const normalizedCaption = String(currentCaptionRef.current ?? '').trim().slice(0, 500)
    if (normalizedCaption === persistedCaptionRef.current) {
      if (currentCaptionRef.current !== normalizedCaption) {
        onCaptionChange(normalizedCaption)
      }
      return
    }

    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion
    setStatus('saving')

    try {
      const response = await updateGalleryCaption(imageId, normalizedCaption)
      if (requestVersion !== requestVersionRef.current) return

      const savedCaption = typeof response?.caption === 'string'
        ? response.caption.slice(0, 500)
        : normalizedCaption
      persistedCaptionRef.current = savedCaption

      if (String(currentCaptionRef.current ?? '').trim() === normalizedCaption) {
        onCaptionChange(savedCaption)
        setStatus('saved')
      } else {
        setStatus('idle')
      }
    } catch {
      if (requestVersion === requestVersionRef.current) {
        setStatus('error')
      }
    }
  }, [disabled, imageId, onCaptionChange])

  const handleChangeText = useCallback((value: string) => {
    const nextCaption = value.slice(0, 500)
    currentCaptionRef.current = nextCaption
    onCaptionChange(nextCaption)
    setStatus('idle')
  }, [onCaptionChange])

  const statusContent = status === 'saving' ? (
    <View style={styles.statusRow} testID={`gallery-caption-saving-${imageId}`}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.helperText}>Сохраняем…</Text>
    </View>
  ) : status === 'saved' ? (
    <Text style={styles.savedText} testID={`gallery-caption-saved-${imageId}`}>Сохранено</Text>
  ) : status === 'error' ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Повторить сохранение подписи"
      onPress={() => void persistCaption()}
      testID={`gallery-caption-retry-${imageId}`}
    >
      <Text style={styles.errorText}>Не сохранено — повторить</Text>
    </Pressable>
  ) : (
    <Text style={styles.helperText}>{caption.length}/500</Text>
  )

  return (
    <View style={styles.container}>
      <TextInput
        value={caption}
        onChangeText={handleChangeText}
        onBlur={() => void persistCaption()}
        onSubmitEditing={() => void persistCaption()}
        placeholder="Что это за место?"
        placeholderTextColor={colors.textMuted}
        maxLength={500}
        multiline
        editable={!disabled && status !== 'saving'}
        accessibilityLabel="Подпись к фотографии: что это за место"
        testID={`gallery-caption-input-${imageId}`}
        style={styles.input}
      />
      <View style={styles.footer}>{statusContent}</View>
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    gap: DESIGN_TOKENS.spacing.xxs,
    padding: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 48,
    maxHeight: 96,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.sm,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    textAlignVertical: 'top',
  },
  footer: {
    minHeight: 18,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xxs,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
  },
  savedText: {
    color: colors.success,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
  },
})
