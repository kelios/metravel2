import Feather from '@expo/vector-icons/Feather'
import { Text, TextInput, View } from 'react-native'

import Button from '@/components/ui/Button'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

export type FacebookPublishUiState =
  | 'idle'
  | 'connecting'
  | 'publishing'
  | 'published'
  | 'already_published'
  | 'not_connected'
  | 'error'

type FacebookPublishPanelProps = {
  colors: ThemedColors
  styles: any
  message: string
  pageName?: string
  connected: boolean
  canPublish: boolean
  state: FacebookPublishUiState
  postUrl?: string
  onMessageChange: (value: string) => void
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
  onMessageChange,
  onConnect,
  onPublish,
  onOpenPost,
}: FacebookPublishPanelProps) {
  const isConnecting = state === 'connecting'
  const isPublishing = state === 'publishing'
  const isBusy = isConnecting || isPublishing

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
