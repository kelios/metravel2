import React from 'react'
import { Image as ExpoImage } from 'expo-image'
import Feather from '@expo/vector-icons/Feather'
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

type InstagramPublishPanelProps = {
  colors: ThemedColors
  styles: any
  editableInstagramCaption: string
  editableInstagramHashtags: string
  editableInstagramImages: string[]
  draggedInstagramImageIndex: number | null
  instagramCaptionLength: number
  instagramHashtagCount: number
  instagramFinalLength: number
  isInstagramCaptionTooLong: boolean
  isInstagramHashtagCountTooHigh: boolean
  instagramCaptionMaxLength: number
  instagramHashtagMaxCount: number
  finalInstagramText: string
  onCaptionChange: (value: string) => void
  onHashtagsChange: (value: string) => void
  onMoveImage: (index: number, direction: -1 | 1) => void
  onRemoveImage: (index: number) => void
  onDragStart: (index: number) => void
  onDrop: (targetIndex: number) => void
  onDragEnd: () => void
  onCopyText: () => void
  onPublish: () => void
}

function InstagramGalleryItem({
  colors,
  styles,
  imageUrl,
  index,
  isDragging,
  isLast,
  iconSize,
  editableInstagramImagesCount,
  onMoveImage,
  onRemoveImage,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  colors: ThemedColors
  styles: any
  imageUrl: string
  index: number
  isDragging: boolean
  isLast: boolean
  iconSize: number
  editableInstagramImagesCount: number
  onMoveImage: (index: number, direction: -1 | 1) => void
  onRemoveImage: (index: number) => void
  onDragStart: (index: number) => void
  onDrop: (targetIndex: number) => void
  onDragEnd: () => void
}) {
  const dragProps = Platform.OS === 'web'
    ? ({
        draggable: true,
        onDragStart: (event: any) => {
          event?.dataTransfer?.setData?.('text/plain', String(index))
          if (event?.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move'
          }
          onDragStart(index)
        },
        onDragOver: (event: any) => {
          event?.preventDefault?.()
          if (event?.dataTransfer) {
            event.dataTransfer.dropEffect = 'move'
          }
        },
        onDrop: (event: any) => {
          event?.preventDefault?.()
          onDrop(index)
        },
        onDragEnd,
      } as any)
    : {}

  return (
    <View
      style={[
        styles.instagramGalleryCard,
        isDragging && styles.instagramGalleryCardDragging,
      ]}
      testID="instagram-preview-image"
      {...dragProps}
    >
      <ExpoImage
        source={{ uri: imageUrl }}
        style={styles.instagramGalleryImage}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.instagramGalleryDragHandle}>
        <Feather name="move" size={iconSize} color={colors.textSecondary} />
      </View>
      <Pressable
        onPress={() => onRemoveImage(index)}
        style={styles.instagramGalleryRemoveButton}
        testID={`instagram-remove-${index}`}
        accessibilityLabel={`Исключить фото ${index + 1} из публикации`}
      >
        <Feather name="x" size={iconSize} color={colors.textInverse} />
      </Pressable>
      <View style={styles.instagramGalleryControls}>
        <Pressable
          onPress={() => onMoveImage(index, -1)}
          disabled={index === 0}
          style={[
            styles.instagramGalleryControlButton,
            index === 0 && styles.instagramGalleryControlButtonDisabled,
          ]}
          testID={`instagram-move-left-${index}`}
          accessibilityLabel={`Переместить фото ${index + 1} влево`}
        >
          <Feather name="chevron-left" size={iconSize + 2} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => onMoveImage(index, 1)}
          disabled={index === editableInstagramImagesCount - 1 || isLast}
          style={[
            styles.instagramGalleryControlButton,
            (index === editableInstagramImagesCount - 1 || isLast) && styles.instagramGalleryControlButtonDisabled,
          ]}
          testID={`instagram-move-right-${index}`}
          accessibilityLabel={`Переместить фото ${index + 1} вправо`}
        >
          <Feather name="chevron-right" size={iconSize + 2} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  )
}

export default function InstagramPublishPanel({
  colors,
  styles,
  editableInstagramCaption,
  editableInstagramHashtags,
  editableInstagramImages,
  draggedInstagramImageIndex,
  instagramCaptionLength,
  instagramHashtagCount,
  instagramFinalLength,
  isInstagramCaptionTooLong,
  isInstagramHashtagCountTooHigh,
  instagramCaptionMaxLength,
  instagramHashtagMaxCount,
  finalInstagramText,
  onCaptionChange,
  onHashtagsChange,
  onMoveImage,
  onRemoveImage,
  onDragStart,
  onDrop,
  onDragEnd,
  onCopyText,
  onPublish,
}: InstagramPublishPanelProps) {
  return (
    <View style={[styles.card, styles.instagramCard]}>
      <Text style={styles.cardTitle}>Instagram публикация</Text>
      <Text style={styles.adminHint}>
        Берутся только первые 10 фото из галереи. Порядок можно поменять вручную.
      </Text>

      <View style={styles.instagramControlRow}>
        <View style={styles.instagramCounterPill}>
          <Text style={styles.instagramCounterLabel}>Длина caption</Text>
          <Text
            style={[
              styles.instagramCounterValue,
              isInstagramCaptionTooLong && styles.instagramCounterDanger,
            ]}
          >
            {instagramFinalLength}/{instagramCaptionMaxLength}
          </Text>
        </View>
        <View style={styles.instagramCounterPill}>
          <Text style={styles.instagramCounterLabel}>Хэштеги</Text>
          <Text
            style={[
              styles.instagramCounterValue,
              isInstagramHashtagCountTooHigh && styles.instagramCounterDanger,
            ]}
          >
            {instagramHashtagCount}/{instagramHashtagMaxCount}
          </Text>
        </View>
      </View>

      <View style={styles.instagramEditor}>
        <Text style={styles.instagramEditorLabel}>Caption</Text>
        <TextInput
          value={editableInstagramCaption}
          onChangeText={onCaptionChange}
          style={styles.instagramCaptionInput}
          multiline
          placeholder="Опишите маршрут и добавьте призыв к действию"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Instagram caption"
        />
      </View>

      <View style={styles.instagramEditor}>
        <Text style={styles.instagramEditorLabel}>Хэштеги</Text>
        <TextInput
          value={editableInstagramHashtags}
          onChangeText={onHashtagsChange}
          style={styles.instagramCaptionInput}
          multiline
          placeholder="#метки #путешествия"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Instagram hashtags"
        />
      </View>

      <Text style={styles.instagramHintText}>
        Перетаскивайте карточки мышью или используйте стрелки для точной перестановки.
      </Text>

      {Platform.OS === 'web' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: DESIGN_TOKENS.spacing.md,
            width: '100%',
            marginTop: DESIGN_TOKENS.spacing.md,
          }}
        >
          {editableInstagramImages.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              data-testid="instagram-preview-image"
              style={Object.assign(
                {},
                styles.instagramGalleryCard as any,
                draggedInstagramImageIndex === index
                  ? (styles.instagramGalleryCardDragging as any)
                  : null,
                { display: 'block' }
              )}
              {...({
                draggable: true,
                onDragStart: (event: any) => {
                  event?.dataTransfer?.setData?.('text/plain', String(index))
                  if (event?.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move'
                  }
                  onDragStart(index)
                },
                onDragOver: (event: any) => {
                  event?.preventDefault?.()
                  if (event?.dataTransfer) {
                    event.dataTransfer.dropEffect = 'move'
                  }
                },
                onDrop: (event: any) => {
                  event?.preventDefault?.()
                  onDrop(index)
                },
                onDragEnd,
              } as any)}
            >
              <ExpoImage
                source={{ uri: imageUrl }}
                style={styles.instagramGalleryImage}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.instagramGalleryDragHandle}>
                <Feather name="move" size={18} color={colors.textSecondary} />
              </View>
              <Pressable
                onPress={() => onRemoveImage(index)}
                style={styles.instagramGalleryRemoveButton}
                testID={`instagram-remove-${index}`}
                accessibilityLabel={`Исключить фото ${index + 1} из публикации`}
              >
                <Feather name="x" size={18} color={colors.textInverse} />
              </Pressable>
              <View style={styles.instagramGalleryControls}>
                <Pressable
                  onPress={() => onMoveImage(index, -1)}
                  disabled={index === 0}
                  style={[
                    styles.instagramGalleryControlButton,
                    index === 0 && styles.instagramGalleryControlButtonDisabled,
                  ]}
                  testID={`instagram-move-left-${index}`}
                  accessibilityLabel={`Переместить фото ${index + 1} влево`}
                >
                  <Feather name="chevron-left" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => onMoveImage(index, 1)}
                  disabled={index === editableInstagramImages.length - 1}
                  style={[
                    styles.instagramGalleryControlButton,
                    index === editableInstagramImages.length - 1 && styles.instagramGalleryControlButtonDisabled,
                  ]}
                  testID={`instagram-move-right-${index}`}
                  accessibilityLabel={`Переместить фото ${index + 1} вправо`}
                >
                  <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </div>
          ))}
        </div>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.instagramGalleryRow}
        >
          {editableInstagramImages.map((imageUrl, index) => (
            <InstagramGalleryItem
              key={`${imageUrl}-${index}`}
              colors={colors}
              styles={styles}
              imageUrl={imageUrl}
              index={index}
              isDragging={draggedInstagramImageIndex === index}
              isLast={index === editableInstagramImages.length - 1}
              iconSize={16}
              editableInstagramImagesCount={editableInstagramImages.length}
              onMoveImage={onMoveImage}
              onRemoveImage={onRemoveImage}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.instagramPreview}>
        <View style={styles.instagramFieldHeader}>
          <Text style={styles.rejectionCommentLabel}>Текст поста</Text>
          <Text
            style={[
              styles.instagramCounter,
              isInstagramCaptionTooLong && styles.instagramCounterDanger,
            ]}
          >
            {instagramFinalLength}/{instagramCaptionMaxLength} символов
          </Text>
        </View>
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
          value={editableInstagramCaption}
          onChangeText={onCaptionChange}
          placeholder="Текст публикации"
          placeholderTextColor={colors.textMuted}
          multiline
          accessibilityLabel="Текст поста для Instagram"
        />
        <Text
          style={[
            styles.instagramHintText,
            isInstagramCaptionTooLong && styles.instagramHintDanger,
          ]}
        >
          Текст: {instagramCaptionLength} символов. Итоговый caption с тегами должен быть не длиннее {instagramCaptionMaxLength} символов.
        </Text>
      </View>

      <View style={styles.instagramPreview}>
        <View style={styles.instagramFieldHeader}>
          <Text style={styles.rejectionCommentLabel}>Хэштеги</Text>
          <Text
            style={[
              styles.instagramCounter,
              isInstagramHashtagCountTooHigh && styles.instagramCounterDanger,
            ]}
          >
            {instagramHashtagCount}/{instagramHashtagMaxCount} тегов
          </Text>
        </View>
        <TextInput
          style={[
            styles.rejectionCommentInput,
            {
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              borderColor: colors.borderLight,
            },
          ]}
          value={editableInstagramHashtags}
          onChangeText={onHashtagsChange}
          placeholder="#metravelby #польша"
          placeholderTextColor={colors.textMuted}
          multiline
          accessibilityLabel="Хэштеги для Instagram"
        />
        <Text
          style={[
            styles.instagramHintText,
            isInstagramHashtagCountTooHigh && styles.instagramHintDanger,
          ]}
        >
          Instagram допускает до {instagramHashtagMaxCount} хэштегов. Сейчас распознано {instagramHashtagCount}.
        </Text>
      </View>

      <View style={styles.instagramPreview}>
        <View style={styles.instagramFieldHeader}>
          <Text style={styles.rejectionCommentLabel}>Предпросмотр</Text>
          <Text
            style={[
              styles.instagramCounter,
              isInstagramCaptionTooLong && styles.instagramCounterDanger,
            ]}
          >
            {instagramFinalLength}/{instagramCaptionMaxLength}
          </Text>
        </View>
        <Text style={styles.instagramPreviewText}>
          {finalInstagramText}
        </Text>
      </View>

      <View style={styles.adminButtons}>
        <Button
          label="Скопировать текст"
          onPress={onCopyText}
          icon={<Feather name="copy" size={18} color={colors.textOnPrimary} />}
          variant="secondary"
          size="md"
          style={styles.adminButton}
          labelStyle={styles.adminButtonText}
          accessibilityLabel="Скопировать текст для Instagram"
        />
      </View>

      <View style={styles.adminButtons}>
        <Button
          label="Опубликовать в Instagram"
          onPress={onPublish}
          icon={<Feather name="instagram" size={18} color={colors.textOnPrimary} />}
          variant="primary"
          size="md"
          style={styles.adminButton}
          labelStyle={styles.adminButtonText}
          accessibilityLabel="Опубликовать в Instagram"
        />
      </View>
    </View>
  )
}
