import ImageCardMedia from '@/components/ui/ImageCardMedia'
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
import { translate as i18nT } from '@/i18n'


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
  onConnect: () => void
  onPublish: () => void
  isConnecting?: boolean
  isPublishing?: boolean
}

function InstagramGalleryItem({
  colors,
  styles,
  imageUrl,
  index,
  isDragging,
  isLast,
  iconSize,
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
  onMoveImage: (index: number, direction: -1 | 1) => void
  onRemoveImage: (index: number) => void
  onDragStart: (index: number) => void
  onDrop: (targetIndex: number) => void
  onDragEnd: () => void
}) {
  const dragProps =
    Platform.OS === 'web'
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
      <ImageCardMedia
        source={{ uri: imageUrl }}
        style={styles.instagramGalleryImage}
        fit="cover"
      />
      <View style={styles.instagramGalleryDragHandle}>
        <Feather name="move" size={iconSize} color={colors.textSecondary} />
      </View>
      <Pressable
        onPress={() => onRemoveImage(index)}
        style={styles.instagramGalleryRemoveButton}
        testID={`instagram-remove-${index}`}
        accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.isklyuchit_foto_value1_iz_publikatsii_cded6c1a', { value1: index + 1 })}
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
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.peremestit_foto_value1_vlevo_cff6df19', { value1: index + 1 })}
        >
          <Feather
            name="chevron-left"
            size={iconSize + 2}
            color={colors.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={() => onMoveImage(index, 1)}
          disabled={isLast}
          style={[
            styles.instagramGalleryControlButton,
            isLast && styles.instagramGalleryControlButtonDisabled,
          ]}
          testID={`instagram-move-right-${index}`}
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.peremestit_foto_value1_vpravo_1678a1d6', { value1: index + 1 })}
        >
          <Feather
            name="chevron-right"
            size={iconSize + 2}
            color={colors.textSecondary}
          />
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
  onConnect,
  onPublish,
  isConnecting = false,
  isPublishing = false,
}: InstagramPublishPanelProps) {
  return (
    <View style={[styles.card, styles.instagramCard]}>
      <Text style={styles.cardTitle}>{i18nT('travel:components.travel.InstagramPublishPanel.instagram_publikatsiya_2cf828a3')}</Text>
      <Text style={styles.adminHint}>
        {i18nT('travel:components.travel.InstagramPublishPanel.berutsya_tolko_pervye_10_foto_iz_galerei_por_a0afd9f0')}</Text>

      <View style={styles.instagramControlRow}>
        <View style={styles.instagramCounterPill}>
          <Text style={styles.instagramCounterLabel}>{i18nT('travel:components.travel.InstagramPublishPanel.dlina_caption_0ba447e1')}</Text>
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
          <Text style={styles.instagramCounterLabel}>{i18nT('travel:components.travel.InstagramPublishPanel.heshtegi_45eece16')}</Text>
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
        <Text style={styles.instagramEditorLabel}>{i18nT('travel:components.travel.InstagramPublishPanel.caption_5f9135b2')}</Text>
        <TextInput
          value={editableInstagramCaption}
          onChangeText={onCaptionChange}
          style={styles.instagramCaptionInput}
          multiline
          placeholder={i18nT('travel:components.travel.InstagramPublishPanel.opishite_marshrut_i_dobavte_prizyv_k_deystvi_87bb5037')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.instagram_caption_d3fed686')}
        />
      </View>

      <View style={styles.instagramEditor}>
        <Text style={styles.instagramEditorLabel}>{i18nT('travel:components.travel.InstagramPublishPanel.heshtegi_45eece16')}</Text>
        <TextInput
          value={editableInstagramHashtags}
          onChangeText={onHashtagsChange}
          style={styles.instagramCaptionInput}
          multiline
          placeholder={i18nT('travel:components.travel.InstagramPublishPanel.metki_puteshestviya_f1333591')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.instagram_hashtags_2bc1b44c')}
        />
      </View>

      <Text style={styles.instagramHintText}>
        {i18nT('travel:components.travel.InstagramPublishPanel.peretaskivayte_kartochki_myshyu_ili_ispolzuy_92bd969d')}</Text>

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
              key={imageUrl}
              data-testid="instagram-preview-image"
              style={Object.assign(
                {},
                styles.instagramGalleryCard as any,
                draggedInstagramImageIndex === index
                  ? (styles.instagramGalleryCardDragging as any)
                  : null,
                { display: 'block' },
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
              <ImageCardMedia
                source={{ uri: imageUrl }}
                style={styles.instagramGalleryImage}
                fit="cover"
              />
              <View style={styles.instagramGalleryDragHandle}>
                <Feather name="move" size={18} color={colors.textSecondary} />
              </View>
              <Pressable
                onPress={() => onRemoveImage(index)}
                style={styles.instagramGalleryRemoveButton}
                testID={`instagram-remove-${index}`}
                accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.isklyuchit_foto_value1_iz_publikatsii_cded6c1a', { value1: index + 1 })}
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
                  accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.peremestit_foto_value1_vlevo_cff6df19', { value1: index + 1 })}
                >
                  <Feather
                    name="chevron-left"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
                <Pressable
                  onPress={() => onMoveImage(index, 1)}
                  disabled={index === editableInstagramImages.length - 1}
                  style={[
                    styles.instagramGalleryControlButton,
                    index === editableInstagramImages.length - 1 &&
                      styles.instagramGalleryControlButtonDisabled,
                  ]}
                  testID={`instagram-move-right-${index}`}
                  accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.peremestit_foto_value1_vpravo_1678a1d6', { value1: index + 1 })}
                >
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={colors.textSecondary}
                  />
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
              key={imageUrl}
              colors={colors}
              styles={styles}
              imageUrl={imageUrl}
              index={index}
              isDragging={draggedInstagramImageIndex === index}
              isLast={index === editableInstagramImages.length - 1}
              iconSize={16}
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
          <Text style={styles.rejectionCommentLabel}>{i18nT('travel:components.travel.InstagramPublishPanel.tekst_posta_292cad89')}</Text>
          <Text
            style={[
              styles.instagramCounter,
              isInstagramCaptionTooLong && styles.instagramCounterDanger,
            ]}
          >
            {instagramFinalLength}/{instagramCaptionMaxLength} {i18nT('travel:components.travel.InstagramPublishPanel.simvolov_6dd28e72')}</Text>
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
          placeholder={i18nT('travel:components.travel.InstagramPublishPanel.tekst_publikatsii_b42f5ff0')}
          placeholderTextColor={colors.textMuted}
          multiline
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.tekst_posta_dlya_instagram_40424367')}
        />
        <Text
          style={[
            styles.instagramHintText,
            isInstagramCaptionTooLong && styles.instagramHintDanger,
          ]}
        >
          {i18nT('travel:components.travel.InstagramPublishPanel.tekst_7756018e')}{instagramCaptionLength} {i18nT('travel:components.travel.InstagramPublishPanel.simvolov_itogovyy_caption_s_tegami_dolzhen_b_545f384a')}{instagramCaptionMaxLength} {i18nT('travel:components.travel.InstagramPublishPanel.simvolov_e806e0ee')}</Text>
      </View>

      <View style={styles.instagramPreview}>
        <View style={styles.instagramFieldHeader}>
          <Text style={styles.rejectionCommentLabel}>{i18nT('travel:components.travel.InstagramPublishPanel.heshtegi_45eece16')}</Text>
          <Text
            style={[
              styles.instagramCounter,
              isInstagramHashtagCountTooHigh && styles.instagramCounterDanger,
            ]}
          >
            {instagramHashtagCount}/{instagramHashtagMaxCount} {i18nT('travel:components.travel.InstagramPublishPanel.tegov_ecb02fbb')}</Text>
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
          placeholder={i18nT('travel:components.travel.InstagramPublishPanel.metravelby_polsha_6e00b999')}
          placeholderTextColor={colors.textMuted}
          multiline
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.heshtegi_dlya_instagram_4d576c95')}
        />
        <Text
          style={[
            styles.instagramHintText,
            isInstagramHashtagCountTooHigh && styles.instagramHintDanger,
          ]}
        >
          {i18nT('travel:components.travel.InstagramPublishPanel.instagram_dopuskaet_do_d2797a8f')}{instagramHashtagMaxCount} {i18nT('travel:components.travel.InstagramPublishPanel.heshtegov_seychas_raspoznano_257e2896')}{instagramHashtagCount}.
        </Text>
      </View>

      <View style={styles.instagramPreview}>
        <View style={styles.instagramFieldHeader}>
          <Text style={styles.rejectionCommentLabel}>{i18nT('travel:components.travel.InstagramPublishPanel.predprosmotr_dc5089bd')}</Text>
          <Text
            style={[
              styles.instagramCounter,
              isInstagramCaptionTooLong && styles.instagramCounterDanger,
            ]}
          >
            {instagramFinalLength}/{instagramCaptionMaxLength}
          </Text>
        </View>
        <Text style={styles.instagramPreviewText}>{finalInstagramText}</Text>
      </View>

      <View style={styles.adminButtons}>
        <Button
          label={i18nT('travel:components.travel.InstagramPublishPanel.skopirovat_tekst_4a932939')}
          onPress={onCopyText}
          icon={<Feather name="copy" size={18} color={colors.textOnPrimary} />}
          variant="secondary"
          size="md"
          style={styles.adminButton}
          labelStyle={styles.adminButtonText}
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.skopirovat_tekst_dlya_instagram_fddd37ac')}
        />
      </View>

      <Text style={styles.adminHint}>
        {i18nT('travel:components.travel.InstagramPublishPanel.pered_pervoy_publikatsiey_odin_raz_podklyuch_ec7d7bdf')}</Text>

      <View style={styles.adminButtons}>
        <Button
          label={i18nT('travel:components.travel.InstagramPublishPanel.podklyuchit_instagram_43bf83ab')}
          onPress={onConnect}
          disabled={isConnecting || isPublishing}
          loading={isConnecting}
          icon={<Feather name="link" size={18} color={colors.textOnPrimary} />}
          variant="secondary"
          size="md"
          style={styles.adminButton}
          labelStyle={styles.adminButtonText}
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.podklyuchit_akkaunt_instagram_1c920bca')}
        />
      </View>

      <View style={styles.adminButtons}>
        <Button
          label={i18nT('travel:components.travel.InstagramPublishPanel.opublikovat_v_instagram_9e103c36')}
          onPress={onPublish}
          disabled={isPublishing || isConnecting}
          loading={isPublishing}
          icon={
            <Feather name="instagram" size={18} color={colors.textOnPrimary} />
          }
          variant="primary"
          size="md"
          style={styles.adminButton}
          labelStyle={styles.adminButtonText}
          accessibilityLabel={i18nT('travel:components.travel.InstagramPublishPanel.opublikovat_v_instagram_9e103c36')}
        />
      </View>
    </View>
  )
}
