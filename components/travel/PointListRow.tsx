import React, { useCallback, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CardActionPressable from '@/components/ui/CardActionPressable';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import PointNavigationMenu from '@/components/navigation/PointNavigationMenu';
import { globalFocusStyles } from '@/styles/globalFocus';

type PointLike = {
  id: string;
  address: string;
  coord: string;
};

type PointListRowProps = {
  addButtonDisabled?: boolean;
  addButtonLoading?: boolean;
  categoryLabel?: string;
  colors: {
    primary: string;
    textMuted: string;
  };
  imageUrl?: string;
  index: number;
  onAddPoint?: () => void;
  onCardPress?: () => void;
  onCopy: (coordStr: string) => void | Promise<void>;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  onShare: (coordStr: string) => void | Promise<void>;
  point: PointLike;
  styles: Record<string, any>;
};

const PointListRow = React.memo(function PointListRow({
  addButtonDisabled,
  addButtonLoading,
  categoryLabel,
  colors,
  imageUrl,
  index,
  onAddPoint,
  onCardPress,
  onCopy,
  onOpenMap,
  onShare,
  point,
  styles,
}: PointListRowProps) {
  const [imageError, setImageError] = useState(false);
  const handleImageError = useCallback(() => setImageError(true), []);
  const openMapFromLink = useCallback(() => onOpenMap(point.coord), [onOpenMap, point.coord]);

  return (
    <View style={styles.listRow}>
      <Pressable
        onPress={onCardPress ?? openMapFromLink}
        style={[styles.listRowPressable, globalFocusStyles.focusable]}
        accessibilityRole="button"
        accessibilityLabel={`Открыть место: ${point.address}`}
      >
        <View style={styles.listRowThumb}>
          {imageUrl && !imageError ? (
            <ImageCardMedia
              src={imageUrl}
              alt={point.address}
              fit="contain"
              blurBackground
              allowCriticalWebBlur
              blurRadius={16}
              priority="low"
              loading={Platform.OS === 'web' ? 'lazy' : 'lazy'}
              onError={handleImageError}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.listRowThumbPlaceholder} />
          )}
        </View>

        <View style={styles.listRowInfo}>
          <View style={styles.listRowHeader}>
            <View style={styles.listRowBullet}>
              <Text style={styles.listRowBulletText}>{index + 1}</Text>
            </View>
            <Text style={styles.listRowTitle} numberOfLines={2}>
              {point.address || 'Без адреса'}
            </Text>
          </View>

          {point.coord ? (
            <CardActionPressable
              style={[styles.listRowCoordChip, globalFocusStyles.focusable]}
              onPress={openMapFromLink}
              accessibilityLabel={`Координаты: ${point.coord}`}
              title="Открыть координаты в Google Maps"
            >
              <Feather name="map-pin" size={12} color={colors.textMuted} />
              <Text style={styles.listRowCoordText} numberOfLines={1}>
                {point.coord}
              </Text>
            </CardActionPressable>
          ) : null}

          {!!categoryLabel && (
            <Text style={styles.listRowCategory} numberOfLines={1}>
              {categoryLabel}
            </Text>
          )}

          <View style={styles.listRowActions}>
            {point.coord ? (
              <>
                {/* Утилиты: копировать, поделиться */}
                <CardActionPressable
                  accessibilityLabel="Скопировать координаты"
                  onPress={() => onCopy(point.coord)}
                  title="Скопировать координаты"
                  style={styles.listRowIconBtn}
                >
                  <Feather name="copy" size={14} color={colors.textMuted} />
                </CardActionPressable>
                <CardActionPressable
                  accessibilityLabel="Поделиться в Telegram"
                  onPress={() => onShare(point.coord)}
                  title="Телеграм"
                  style={styles.listRowIconBtn}
                >
                  <Feather name="send" size={14} color={colors.textMuted} />
                </CardActionPressable>

                <View style={styles.listRowNavigationMenu}>
                  <PointNavigationMenu
                    coord={point.coord}
                    label="Навигация"
                    testIDPrefix={`travel-point-row-navigation-${point.id}`}
                  />
                </View>
              </>
            ) : null}

            {onAddPoint && (
              <CardActionPressable
                onPress={onAddPoint}
                disabled={Boolean(addButtonDisabled) || Boolean(addButtonLoading)}
                accessibilityLabel="Мои точки"
                title="Мои точки"
                style={({ pressed }) => [
                  styles.listRowAddBtn,
                  pressed && !addButtonDisabled && !addButtonLoading && styles.addButtonPressed,
                  (addButtonDisabled || addButtonLoading) && styles.addButtonDisabled,
                ]}
              >
                {addButtonLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather name="map-pin" size={13} color={colors.primary} />
                    <Text style={styles.listRowAddBtnText}>Мои точки</Text>
                  </>
                )}
              </CardActionPressable>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export default PointListRow;
