// components/quests/QuestReviewPhotoPicker.tsx
// Выбор до трёх фото к отзыву о квесте (#1579).
//
// Компонент только ВЫБИРАЕТ файлы: загрузка живёт в `QuestReviewSection`, потому
// что до подтверждённого отзыва нет `id`, по которому адресуется загрузка
// (см. `api/questReviewPhoto.ts`). Статусы загрузки приходят сюда сверху.

import { memo, useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import * as ImagePicker from 'expo-image-picker'

import ImageCardMedia from '@/components/ui/ImageCardMedia'

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { compressTravelPhoto } from '@/utils/imageCompressor'
import { QUEST_REVIEW_PHOTO_LIMIT, type QuestReviewPhotoFile } from '@/api/questReviewPhoto'
import { translate as i18nT } from '@/i18n'

/** Один выбранный снимок до загрузки. */
export type QuestReviewPhotoDraft = {
  /** Стабильный ключ: и React-список, и сопоставление со статусом загрузки. */
  key: string
  /** Локальный uri для превью — уже уменьшенный на native. */
  previewUri: string
  /** Имя файла: им ошибка называет игроку конкретный снимок. */
  name: string
  file: QuestReviewPhotoFile
}

export type QuestReviewPhotoStatus = 'idle' | 'uploading' | 'uploaded' | 'failed'

type Props = {
  value: QuestReviewPhotoDraft[]
  onChange: (next: QuestReviewPhotoDraft[]) => void
  /** Статус загрузки по ключу снимка; пусто до отправки отзыва. */
  statuses?: Record<string, QuestReviewPhotoStatus>
  disabled?: boolean
  testID?: string
}

const THUMB_SIZE = 88
/** Минимальная цель нажатия проекта (`scripts/guard-touch-targets.js`). */
const REMOVE_HIT_SIZE = 44

let draftCounter = 0
const nextDraftKey = (): string => {
  draftCounter += 1
  return `quest-review-photo-${draftCounter}`
}

const fallbackName = (index: number): string =>
  i18nT('quests:components.quests.QuestReviewPhotoPicker.unnamedPhoto', { value1: index })

/**
 * Приводит выбранный asset к тому виду, который переживёт FormData.
 * На web это обязан быть настоящий `File`: RN-дескриптор `{uri,name,type}`
 * сериализуется в строку `"[object Object]"`, и сервер отвечает 400
 * (ловушка уже описана в `hooks/useAvatarUpload.ts:188`).
 */
const toDraft = async (
  asset: ImagePicker.ImagePickerAsset,
  index: number,
): Promise<QuestReviewPhotoDraft | null> => {
  if (Platform.OS === 'web') {
    const webFile = (asset as { file?: File }).file
    if (!webFile) return null
    return {
      key: nextDraftKey(),
      previewUri: asset.uri,
      name: webFile.name || asset.fileName || fallbackName(index),
      file: webFile,
    }
  }

  // Полноразмерный кадр камеры и в превью, и в загрузке — лишние десятки
  // мегабайт в памяти слабого устройства, поэтому уменьшаем один раз здесь и
  // дальше везде используем уменьшенный uri.
  const compressed = await compressTravelPhoto(asset.uri)
  const uri = compressed.uri || asset.uri
  return {
    key: nextDraftKey(),
    previewUri: uri,
    name: asset.fileName || fallbackName(index),
    file: {
      uri,
      name: asset.fileName || `quest-review-photo-${index}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    },
  }
}

function QuestReviewPhotoPicker({
  value,
  onChange,
  statuses,
  disabled = false,
  testID = 'quest-review-photo-picker',
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [error, setError] = useState<string | null>(null)

  const remaining = QUEST_REVIEW_PHOTO_LIMIT - value.length
  const limitReached = remaining <= 0

  const appendAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      // Второй рубеж после `selectionLimit`: на web системный диалог лимит
      // игнорирует, и без среза сюда доедет сколько угодно файлов.
      const accepted = assets.slice(0, Math.max(0, remaining))
      const drafts: QuestReviewPhotoDraft[] = []
      for (let i = 0; i < accepted.length; i += 1) {
        const draft = await toDraft(accepted[i], value.length + drafts.length + 1)
        if (draft) drafts.push(draft)
      }

      if (drafts.length === 0) {
        setError(i18nT('quests:components.quests.QuestReviewPhotoPicker.webFileUnavailable'))
        return
      }

      setError(
        assets.length > accepted.length
          ? i18nT('quests:components.quests.QuestReviewPhotoPicker.limitReached', {
              value1: QUEST_REVIEW_PHOTO_LIMIT,
            })
          : null,
      )
      onChange([...value, ...drafts])
    },
    [onChange, remaining, value],
  )

  const handlePickFromGallery = useCallback(async () => {
    if (disabled) return
    if (limitReached) {
      setError(
        i18nT('quests:components.quests.QuestReviewPhotoPicker.limitReached', {
          value1: QUEST_REVIEW_PHOTO_LIMIT,
        }),
      )
      return
    }

    try {
      // Разрешение галереи спрашивается ТОЛЬКО на iOS — как во всех остальных
      // пикерах проекта (`hooks/useAvatarUpload.ts:86`,
      // `components/travel/PhotoUploadWithPreview.tsx:87`). На Android чтение
      // медиатеки заблокировано на уровне сборки (`app.json` → blockedPermissions,
      // `android/app/src/main/AndroidManifest.xml` → READ_MEDIA_IMAGES с
      // `tools:node="remove"`), поэтому запрос там не может быть удовлетворён:
      // система отказывает не спрашивая, и гейт закрыл бы галерею навсегда с
      // советом «разрешите в настройках», которого выполнить нельзя. Выбор
      // работает без разрешения через системный Photo Picker.
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (permission.status !== 'granted') {
          setError(i18nT('quests:components.quests.QuestReviewPhotoPicker.permissionGallery'))
          return
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        // expo-image-picker 57: современный API — массив MediaType.
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
        exif: false,
      })

      // Отмена выбора — не ошибка и не повод трогать уже выбранное.
      if (result.canceled || !result.assets?.length) return
      await appendAssets(result.assets)
    } catch {
      setError(i18nT('quests:components.quests.QuestReviewPhotoPicker.pickFailed'))
    }
  }, [appendAssets, disabled, limitReached, remaining])

  const handleTakePhoto = useCallback(async () => {
    if (disabled || limitReached) return

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (permission.status !== 'granted') {
        setError(i18nT('quests:components.quests.QuestReviewPhotoPicker.permissionCamera'))
        return
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false })
      if (result.canceled || !result.assets?.length) return
      await appendAssets([result.assets[0]])
    } catch {
      setError(i18nT('quests:components.quests.QuestReviewPhotoPicker.pickFailed'))
    }
  }, [appendAssets, disabled, limitReached])

  const handleRemove = useCallback(
    (key: string) => {
      setError(null)
      onChange(value.filter((item) => item.key !== key))
    },
    [onChange, value],
  )

  const statusLabel = useCallback((status: QuestReviewPhotoStatus | undefined): string | null => {
    switch (status) {
      case 'uploading':
        return i18nT('quests:components.quests.QuestReviewPhotoPicker.uploading')
      case 'uploaded':
        return i18nT('quests:components.quests.QuestReviewPhotoPicker.uploaded')
      case 'failed':
        return i18nT('quests:components.quests.QuestReviewPhotoPicker.uploadFailed')
      default:
        return null
    }
  }, [])

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>
        {i18nT('quests:components.quests.QuestReviewPhotoPicker.label')}
      </Text>
      <Text style={styles.hint}>
        {i18nT('quests:components.quests.QuestReviewPhotoPicker.hint', {
          value1: QUEST_REVIEW_PHOTO_LIMIT,
        })}
      </Text>

      {value.length > 0 && (
        <View style={styles.thumbRow} testID={`${testID}-thumbs`}>
          {value.map((draft) => {
            const status = statuses?.[draft.key]
            const label = statusLabel(status)
            return (
              <View key={draft.key} style={styles.thumbWrapper} testID={`${testID}-item-${draft.key}`}>
                <View style={styles.thumb}>
                  {/* Через `ImageCardMedia`, а не голый `expo-image`: прямой
                      импорт примитива внутри `components/**` запрещён ADR
                      `docs/adr/0002-images-via-image-card-media.md` и падает на
                      `npm run check:image-architecture`. Прецедент локального
                      превью выбранного файла — `PhotoUploadWithPreview.tsx:203`.
                      Прокси локальный URI не переписывает: `file:`, `blob:` и
                      `data:` возвращаются из `optimizeImageUrl` как есть
                      (`utils/imageProxy.ts:228,258`). `contain` — инвариант
                      docs/RULES.md → Images and placeholders. */}
                  <ImageCardMedia
                    src={draft.previewUri}
                    width={THUMB_SIZE}
                    height={THUMB_SIZE}
                    fit="contain"
                    alt={draft.name}
                    style={styles.thumbImage}
                    testID={`${testID}-preview-${draft.key}`}
                  />
                </View>
                {!disabled && (
                  <Pressable
                    onPress={() => handleRemove(draft.key)}
                    style={styles.removeButton}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT(
                      'quests:components.quests.QuestReviewPhotoPicker.remove',
                      { value1: draft.name },
                    )}
                    testID={`${testID}-remove-${draft.key}`}
                  >
                    {/* Цель нажатия — все 44 dp прозрачной обёртки, видимый
                        кружок меньше: сплошной круг в 44 dp закрыл бы четверть
                        превью 88×88. */}
                    <View style={styles.removeBadge}>
                      <Feather name="x" size={14} color={colors.textOnPrimary} />
                    </View>
                  </Pressable>
                )}
                {/* Статус объявляется текстом, а не только цветом рамки:
                    иначе он не существует для экранного диктора. */}
                {label && (
                  <Text
                    style={[styles.statusText, status === 'failed' && styles.statusTextFailed]}
                    testID={`${testID}-status-${draft.key}`}
                  >
                    {label}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={handlePickFromGallery}
          disabled={disabled || limitReached}
          style={[styles.actionButton, (disabled || limitReached) && styles.actionButtonDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || limitReached }}
          accessibilityLabel={i18nT(
            'quests:components.quests.QuestReviewPhotoPicker.addFromGallery',
          )}
          testID={`${testID}-add`}
        >
          <Feather name="image" size={16} color={colors.primaryText} />
          <Text style={styles.actionText}>
            {i18nT('quests:components.quests.QuestReviewPhotoPicker.addFromGallery')}
          </Text>
        </Pressable>

        {Platform.OS !== 'web' && (
          <Pressable
            onPress={handleTakePhoto}
            disabled={disabled || limitReached}
            style={[styles.actionButton, (disabled || limitReached) && styles.actionButtonDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || limitReached }}
            accessibilityLabel={i18nT(
              'quests:components.quests.QuestReviewPhotoPicker.addFromCamera',
            )}
            testID={`${testID}-camera`}
          >
            <Feather name="camera" size={16} color={colors.primaryText} />
            <Text style={styles.actionText}>
              {i18nT('quests:components.quests.QuestReviewPhotoPicker.addFromCamera')}
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.counter} testID={`${testID}-counter`}>
        {i18nT('quests:components.quests.QuestReviewPhotoPicker.selectedCount', {
          value1: value.length,
          value2: QUEST_REVIEW_PHOTO_LIMIT,
        })}
      </Text>

      {!!error && (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID={`${testID}-error`}
        >
          {error}
        </Text>
      )}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    hint: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    thumbRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    thumbWrapper: {
      width: THUMB_SIZE,
      gap: 4,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: DESIGN_TOKENS.radii.sm,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    removeButton: {
      // Кнопка держится ВНУТРИ границ `thumbWrapper`: вынесенная за них часть
      // (здесь было `top/right: -11`) на Android не получает касаний вовсе —
      // родитель не доставляет touch за свои пределы, и от цели 44×44 оставалось
      // бы 33×33. Тот же приём — у существующей кнопки удаления превью
      // (`components/travel/PhotoUploadWithPreview.tsx:259`).
      position: 'absolute',
      top: 0,
      right: 0,
      width: REMOVE_HIT_SIZE,
      height: REMOVE_HIT_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    statusText: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.textMuted,
    },
    statusTextFailed: {
      color: colors.danger,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: REMOVE_HIT_SIZE,
      paddingHorizontal: 14,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryText,
    },
    counter: {
      fontSize: 12,
      color: colors.textMuted,
    },
    errorText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.danger,
    },
  })

export default memo(QuestReviewPhotoPicker)
