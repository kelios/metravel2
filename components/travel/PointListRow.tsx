import React, { useCallback, useMemo, useState } from 'react';
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
  onOpenGoogleMap: () => void;
  onOpenMap: (coordStr: string) => void | Promise<void>;
  onOpenOsmMap: () => void;
  onOpenWaze?: () => void;
  onOpenYandexMap: () => void;
  onOpenYandexNavi?: () => void;
  onShare: (coordStr: string) => void | Promise<void>;
  point: PointLike;
  styles: Record<string, any>;
};

const PointActionChip = React.memo(function PointActionChip({
  chipStyle,
  icon,
  label,
  onPress,
  textStyle,
  title,
}: {
  chipStyle: any;
  icon?: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  textStyle: any;
  title?: string;
}) {
  return (
    <CardActionPressable
      style={chipStyle}
      onPress={onPress}
      accessibilityLabel={label}
      title={title ?? label}
    >
      {icon && <Feather name={icon} size={10} color={textStyle?.color ?? '#888'} style={{ marginRight: 3 }} />}
      <Text style={textStyle}>{label}</Text>
    </CardActionPressable>
  );
});

const SectionLabel = React.memo(function SectionLabel({ label, style }: { label: string; style: any }) {
  return <Text style={style}>{label}</Text>;
});

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
  onOpenGoogleMap,
  onOpenMap,
  onOpenOsmMap,
  onOpenWaze,
  onOpenYandexMap,
  onOpenYandexNavi,
  onShare,
  point,
  styles,
}: PointListRowProps) {
  const [imageError, setImageError] = useState(false);
  const handleImageError = useCallback(() => setImageError(true), []);
  const openMapFromLink = useCallback(() => onOpenMap(point.coord), [onOpenMap, point.coord]);

  const hasNavigators = Boolean(onOpenWaze || onOpenYandexNavi);

  const sectionLabelStyle = useMemo(() => ({
    fontSize: 9,
    fontWeight: '600' as const,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginRight: 2,
  }), [colors.textMuted]);

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

                {/* Карты */}
                <PointActionChip
                  label="Google"
                  icon="map-pin"
                  title="Открыть в Google Maps"
                  onPress={onOpenGoogleMap}
                  chipStyle={styles.listRowMapChip}
                  textStyle={styles.listRowMapChipText}
                />
                <PointActionChip
                  label="Яндекс"
                  icon="navigation-2"
                  title="Открыть в Яндекс Картах"
                  onPress={onOpenYandexMap}
                  chipStyle={styles.listRowMapChip}
                  textStyle={styles.listRowMapChipText}
                />
                <PointActionChip
                  label="OSM"
                  icon="map"
                  title="Открыть в OpenStreetMap"
                  onPress={onOpenOsmMap}
                  chipStyle={styles.listRowMapChip}
                  textStyle={styles.listRowMapChipText}
                />

                {/* Навигаторы — визуально отделены */}
                {hasNavigators && (
                  <>
                    <SectionLabel label="навигация:" style={sectionLabelStyle} />
                    {onOpenWaze && (
                      <PointActionChip
                        label="Waze"
                        icon="navigation"
                        title="Проложить маршрут в Waze"
                        onPress={onOpenWaze}
                        chipStyle={styles.listRowNavChip}
                        textStyle={styles.listRowNavChipText}
                      />
                    )}
                    {onOpenYandexNavi && (
                      <PointActionChip
                        label="Навигатор"
                        icon="navigation"
                        title="Проложить маршрут в Яндекс Навигаторе"
                        onPress={onOpenYandexNavi}
                        chipStyle={styles.listRowNavChip}
                        textStyle={styles.listRowNavChipText}
                      />
                    )}
                  </>
                )}
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
