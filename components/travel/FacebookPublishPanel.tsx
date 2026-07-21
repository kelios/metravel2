import ImageCardMedia from '@/components/ui/ImageCardMedia'
import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, TextInput, View } from 'react-native'

import Button from '@/components/ui/Button'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

export type FacebookPublishUiState =
  | 'idle'
  | 'connecting'
  | 'publishing'
  | 'published'
  | 'already_published'
  | 'pending'
  | 'not_connected'
  | 'error'

export type FacebookPublishPhotoOption = {
  id: string
  source: string
  apiId?: number | string
  caption?: string
}

type FacebookPublishPanelProps = {
  colors: ThemedColors
  styles: any
  message: string
  pageName?: string
  connected: boolean
  canPublish: boolean
  state: FacebookPublishUiState
  postUrl?: string
  photoOptions?: FacebookPublishPhotoOption[]
  selectedPhotoIds?: string[]
  maxPhotoCount: number
  onMessageChange: (value: string) => void
  onTogglePhoto?: (photoId: string) => void
  onConnect: () => void
  onPublish: () => void
  onOpenPost: () => void
}

const getStatusLabel = (state: FacebookPublishUiState, connected: boolean): string => {
  switch (state) {
    case 'connecting':
      return i18nT('travel:components.travel.FacebookPublishPanel.statusConnecting')
    case 'publishing':
      return i18nT('travel:components.travel.FacebookPublishPanel.statusPublishing')
    case 'published':
      return i18nT('travel:components.travel.FacebookPublishPanel.statusPublished')
    case 'already_published':
      return i18nT('travel:components.travel.FacebookPublishPanel.statusAlreadyPublished')
    case 'pending':
      return i18nT('travel:components.travel.FacebookPublishPanel.statusPending')
    case 'not_connected':
      return i18nT('travel:components.travel.FacebookPublishPanel.statusNotConnected')
    case 'error':
      return i18nT('travel:components.travel.FacebookPublishPanel.statusError')
    default:
      return connected
        ? i18nT('travel:components.travel.FacebookPublishPanel.statusReady')
        : i18nT('travel:components.travel.FacebookPublishPanel.statusNotConnected')
  }
}

export default function FacebookPublishPanel({
  colors,
  styles,
  message,
  pageName,
  connected,
  canPublish,
  state,
  postUrl,
  photoOptions = [],
  selectedPhotoIds = [],
  maxPhotoCount,
  onMessageChange,
  onTogglePhoto,
  onConnect,
  onPublish,
  onOpenPost,
}: FacebookPublishPanelProps) {
  const isConnecting = state === 'connecting'
  const isPublishing = state === 'publishing'
  const isBusy = isConnecting || isPublishing
  const isPhotoLimitReached = selectedPhotoIds.length >= maxPhotoCount
  // Position in `selectedPhotoIds` is the publication order, so the badge shows it.
  const selectionOrderByPhotoId = new Map(selectedPhotoIds.map((photoId, index) => [photoId, index + 1]))

  return (
    <View style={[styles.card, styles.instagramCard]} testID="facebook-publish-panel">
      <Text style={styles.cardTitle}>
        {i18nT('travel:components.travel.FacebookPublishPanel.title')}
      </Text>
      <Text style={styles.adminHint}>
        {i18nT('travel:components.travel.FacebookPublishPanel.description')}
      </Text>

      <View style={styles.instagramPreview}>
        <Text style={styles.rejectionCommentLabel}>
          {i18nT('travel:components.travel.FacebookPublishPanel.messageLabel')}
        </Text>
        <TextInput
          style={[
            styles.rejectionCommentInput,
            styles.instagramCaptionInput,
            {
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              borderColor: colors.borderLight,
            },
          ]}
          value={message}
          onChangeText={onMessageChange}
          placeholder={i18nT('travel:components.travel.FacebookPublishPanel.messagePlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!isBusy}
          accessibilityLabel={i18nT(
            'travel:components.travel.FacebookPublishPanel.messageAccessibilityLabel',
          )}
        />
      </View>

      <View style={styles.facebookPhotoPicker}>
        <View style={styles.instagramFieldHeader}>
          <Text style={styles.rejectionCommentLabel}>
            {i18nT('travel:components.travel.FacebookPublishPanel.photoPickerLabel')}
          </Text>
          {photoOptions.length > 0 ? (
            <Text style={styles.instagramCounter}>
              {i18nT('travel:components.travel.FacebookPublishPanel.photoSelectedCounter', {
                value1: selectedPhotoIds.length,
                value2: photoOptions.length,
                value3: maxPhotoCount,
              })}
            </Text>
          ) : null}
        </View>

        {photoOptions.length > 0 ? (
          <>
            <Text style={styles.instagramHintText}>
              {i18nT('travel:components.travel.FacebookPublishPanel.photoPickerHint', {
                value1: maxPhotoCount,
              })}
            </Text>
            {isPhotoLimitReached && photoOptions.length > maxPhotoCount ? (
              <Text
                style={[styles.instagramHintText, styles.instagramHintDanger]}
                accessibilityLiveRegion="polite"
                testID="facebook-photo-limit-feedback"
              >
                {i18nT('travel:components.travel.FacebookPublishPanel.photoLimitReached', {
                  value1: maxPhotoCount,
                })}
              </Text>
            ) : null}
            <View style={styles.facebookPhotoList}>
              {photoOptions.map((photo, index) => {
                const selectionOrder = selectionOrderByPhotoId.get(photo.id)
                const isSelected = selectionOrder !== undefined
                const isSelectionDisabled = isBusy || !onTogglePhoto || (!isSelected && isPhotoLimitReached)
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => onTogglePhoto?.(photo.id)}
                    disabled={isSelectionDisabled}
                    style={[
                      styles.facebookPhotoCard,
                      isSelected && styles.facebookPhotoCardSelected,
                      isSelectionDisabled && styles.facebookPhotoCardDisabled,
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, disabled: isSelectionDisabled }}
                    accessibilityLabel={i18nT(
                      'travel:components.travel.FacebookPublishPanel.photoAccessibilityLabel',
                      { value1: index + 1 },
                    )}
                    testID={`facebook-photo-${index}`}
                  >
                    <ImageCardMedia
                      source={{ uri: photo.source }}
                      style={styles.instagramGalleryImage}
                      fit="cover"
                    />
                    {isSelected ? (
                      <View style={styles.facebookPhotoCheckBadge}>
                        <Text style={[styles.facebookPhotoOrderText, { color: colors.textOnPrimary }]}>
                          {selectionOrder}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
          </>
        ) : (
          <Text style={styles.facebookPhotoEmpty}>
            {i18nT('travel:components.travel.FacebookPublishPanel.noPhotos')}
          </Text>
        )}
      </View>

      <Text style={styles.adminHint} accessibilityLiveRegion="polite">
        {pageName ? `${pageName}: ` : ''}{getStatusLabel(state, connected)}
      </Text>

      {!connected ? (
        <View style={styles.adminButtons}>
          <Button
            label={i18nT('travel:components.travel.FacebookPublishPanel.connect')}
            onPress={onConnect}
            disabled={isBusy}
            loading={isConnecting}
            icon={<Feather name="link" size={18} color={colors.textOnPrimary} />}
            variant="secondary"
            size="md"
            style={styles.adminButton}
            labelStyle={styles.adminButtonText}
          />
        </View>
      ) : null}

      <View style={styles.adminButtons}>
        <Button
          label={i18nT('travel:components.travel.FacebookPublishPanel.publish')}
          onPress={onPublish}
          disabled={!canPublish || isBusy}
          loading={isPublishing}
          icon={<Feather name="facebook" size={18} color={colors.textOnPrimary} />}
          variant="primary"
          size="md"
          style={styles.adminButton}
          labelStyle={styles.adminButtonText}
        />
      </View>

      {postUrl ? (
        <View style={styles.adminButtons}>
          <Button
            label={i18nT('travel:components.travel.FacebookPublishPanel.openPost')}
            onPress={onOpenPost}
            disabled={isBusy}
            icon={<Feather name="external-link" size={18} color={colors.textOnPrimary} />}
            variant="secondary"
            size="md"
            style={styles.adminButton}
            labelStyle={styles.adminButtonText}
          />
        </View>
      ) : null}
    </View>
  )
}
