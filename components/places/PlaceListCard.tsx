import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import CardActionPressable from '@/components/ui/CardActionPressable';

import { useThemedColors } from '@/hooks/useTheme';

type ActionChip = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  title?: string;
};

type InlineAction = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  title?: string;
};

type Props = {
  title: string;
  imageUrl?: string | null;
  categoryLabel?: string | null;
  coord?: string | null;
  badges?: string[];
  onCardPress?: () => void;
  onMediaPress?: () => void;
  onCopyCoord?: () => void;
  onShare?: () => void;
  mapActions?: ActionChip[];
  inlineActions?: InlineAction[];
  onAddPoint?: () => void;
  addDisabled?: boolean;
  isAdding?: boolean;
  addLabel?: string;
  width?: number;
  imageHeight?: number;
  testID?: string;
  style?: any;
};

const PlaceListCard: React.FC<Props> = ({
  title,
  imageUrl,
  categoryLabel,
  coord,
  badges = [],
  onCardPress,
  onMediaPress,
  onCopyCoord,
  onShare,
  mapActions = [],
  inlineActions = [],
  onAddPoint,
  addDisabled = false,
  isAdding = false,
  addLabel = 'Мои точки',
  width = 300,
  imageHeight = 140,
  testID,
  style,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasCoord = !!coord;
  const showBadges = badges.length > 0;
  const hasMapActions = mapActions.length > 0;
  const hasInlineActions = inlineActions.length > 0;

  return (
    <UnifiedTravelCard
      title={title}
      imageUrl={imageUrl}
      metaText={categoryLabel ?? undefined}
      onPress={onCardPress ?? (() => {})}
      onMediaPress={onMediaPress}
      imageHeight={imageHeight}
      width={width}
      testID={testID}
      style={style}
      contentSlot={
        <View style={styles.content}>
          <Text numberOfLines={2} style={styles.titleText}>
            {title}
          </Text>

          <View style={styles.metaRow}>
            {!!categoryLabel && (
              <Text style={styles.categoryText} numberOfLines={1}>
                {categoryLabel}
              </Text>
            )}
            {showBadges && badges.map((badge) => (
              <Text key={badge} style={styles.badgeText}>{badge}</Text>
            ))}
          </View>

          {/* Compact icon action row */}
          <View style={styles.actionsRow}>
            {hasCoord && onCopyCoord && (
              <CardActionPressable
                accessibilityLabel="Скопировать координаты"
                onPress={() => void onCopyCoord()}
                title={coord || 'Скопировать координаты'}
                style={styles.iconBtn}
              >
                <Feather name="copy" size={14} color={colors.textMuted} />
              </CardActionPressable>
            )}

            {hasCoord && onShare && (
              <CardActionPressable
                accessibilityLabel="Поделиться в Telegram"
                onPress={() => void onShare()}
                title="Телеграм"
                style={styles.iconBtn}
              >
                <Feather name="send" size={14} color={colors.textMuted} />
              </CardActionPressable>
            )}

            {hasMapActions && mapActions.map((action) => (
              <CardActionPressable
                key={action.key}
                accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
                onPress={action.onPress}
                title={action.title ?? action.label}
                style={styles.iconBtn}
              >
                <Feather name={action.icon} size={14} color={colors.textMuted} />
              </CardActionPressable>
            ))}

            {hasInlineActions && inlineActions.map((action) => (
              <CardActionPressable
                key={action.key}
                accessibilityLabel={action.accessibilityLabel ?? action.title ?? action.label}
                onPress={action.onPress}
                title={action.title ?? action.label}
                style={styles.iconBtn}
              >
                <Feather name={action.icon} size={14} color={colors.textMuted} />
              </CardActionPressable>
            ))}
          </View>

          {onAddPoint && (
            <CardActionPressable
              onPress={() => void onAddPoint()}
              disabled={addDisabled || isAdding}
              accessibilityLabel={addLabel}
              title={addLabel}
              style={({ pressed }) => [
                styles.addButton,
                pressed && !addDisabled && !isAdding && styles.addButtonPressed,
                (addDisabled || isAdding) && styles.addButtonDisabled,
              ]}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="map-pin" size={13} color={colors.primary} />
                  <Text style={styles.addButtonText} numberOfLines={1}>
                    {addLabel}
                  </Text>
                </>
              )}
            </CardActionPressable>
          )}
        </View>
      }
      mediaProps={{
        blurBackground: !!imageUrl,
        blurRadius: 16,
        loading: 'lazy',
        priority: 'low',
      }}
      contentContainerStyle={styles.contentContainer}
    />
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    contentContainer: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    content: {
      gap: 6,
    },
    titleText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 18,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    categoryText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    badgeText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    iconBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.backgroundSecondary ?? colors.surface,
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
      }),
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
      ...Platform.select({
        web: {
          cursor: 'pointer' as any,
        },
      }),
    },
    addButtonPressed: {
      opacity: 0.7,
    },
    addButtonDisabled: {
      borderColor: colors.borderLight ?? colors.border,
      opacity: 0.5,
    },
    addButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
  });

export default React.memo(PlaceListCard);
