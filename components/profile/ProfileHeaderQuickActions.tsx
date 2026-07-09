import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';

export type ProfileHeaderActionKey = 'messages' | 'trips' | 'userpoints' | 'calendar' | 'newTravel';

export interface ProfileHeaderQuickActionsProps {
  onPress: (key: ProfileHeaderActionKey) => void;
  unreadMessagesCount?: number;
  /** Рендер поверх фото-обложки: frost-подложка под чипами для контраста. */
  overlay?: boolean;
  /** Компактный режим для мобильного оверлея: icon-only, подпись — в a11y-label. */
  compact?: boolean;
}

// Семантический тон на каждое действие — разбивает монотонный «весь зелёный»
// верх: коммуникация → info, гео → primary, время → warning, создание → brand.
type QuickActionTone = 'info' | 'primary' | 'success' | 'warning' | 'brand';

const ITEMS: Array<{
  key: ProfileHeaderActionKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  tone: QuickActionTone;
  /** Главный CTA — заливается брендом, остальные утилитарны/вторичны. */
  primaryCta?: boolean;
  accessibilityHint: string;
}> = [
  {
    key: 'messages',
    label: 'Чаты',
    icon: 'message-circle',
    tone: 'info',
    accessibilityHint: 'Перейти к сообщениям и диалогам',
  },
  {
    key: 'trips',
    label: 'Поездки',
    icon: 'briefcase',
    tone: 'success',
    accessibilityHint: 'Открыть созданные поездки, заявки и уведомления',
  },
  {
    key: 'userpoints',
    label: 'Мои точки',
    icon: 'map-pin',
    tone: 'primary',
    accessibilityHint: 'Перейти к сохранённым точкам на карте',
  },
  {
    key: 'calendar',
    label: 'Календарь',
    icon: 'calendar',
    tone: 'warning',
    accessibilityHint: 'Перейти к календарю путешествий',
  },
  {
    key: 'newTravel',
    label: 'Маршрут',
    icon: 'plus',
    tone: 'brand',
    primaryCta: true,
    accessibilityHint: 'Создать новый маршрут',
  },
];

export function ProfileHeaderQuickActions({
  onPress,
  unreadMessagesCount = 0,
  overlay = false,
  compact = false,
}: ProfileHeaderQuickActionsProps) {
  const colors = useThemedColors();

  const toneColors = useMemo<Record<QuickActionTone, { fg: string; soft: string }>>(
    () => ({
      info: { fg: colors.info, soft: colors.infoSoft },
      primary: { fg: colors.primary, soft: colors.primarySoft },
      success: { fg: colors.successDark, soft: colors.successSoft },
      warning: { fg: colors.warning, soft: colors.warningSoft },
      brand: { fg: colors.brand, soft: colors.brandSoft },
    }),
    [colors]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          gap: overlay ? DESIGN_TOKENS.spacing.xxs : DESIGN_TOKENS.spacing.xs,
          paddingHorizontal: overlay ? 0 : DESIGN_TOKENS.spacing.md,
          marginBottom: overlay ? 0 : DESIGN_TOKENS.spacing.sm,
          // На desktop-оверлее чипы не растягиваем на всю ширину баннера (иначе
          // они перекрывают кадр) — ряд прижат вправо, чипы по контенту, фото
          // остаётся доминантой. На mobile — компактный ряд icon-only на всю зону.
          ...(overlay && !compact ? { alignSelf: 'flex-end' as const } : {}),
          ...(overlay
            ? {
                borderRadius: DESIGN_TOKENS.radii.pill,
                padding: 4,
                // Frost-подложка под чипами: контраст поверх любого фото-кадра,
                // но кадр остаётся видимым (узкая полоса у нижней кромки).
                backgroundColor: colors.surfaceMuted,
                // Живой blur только на desktop web; на мобильном статичный frost
                // (surfaceMuted) — правило перф-барьеров CLAUDE.md.
                ...Platform.select({
                  web: !compact ? ({ backdropFilter: 'blur(8px)' } as any) : {},
                  default: {},
                }),
              }
            : {}),
        },
        action: {
          // Desktop-оверлей: чипы по контенту (горизонтальный layout icon+label),
          // компактные; mobile/legacy — равные колонки (flex:1, icon над label).
          ...(overlay && !compact
            ? { flexDirection: 'row' as const, paddingHorizontal: 14 }
            : { flex: 1, paddingHorizontal: 2 }),
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? 0 : overlay ? 6 : 4,
          paddingVertical: compact ? 6 : overlay ? 7 : 8,
          borderRadius: overlay ? DESIGN_TOKENS.radii.pill : DESIGN_TOKENS.radii.md,
          backgroundColor: colors.surface,
          borderWidth: overlay ? 0 : 1,
          borderColor: colors.borderLight,
          minHeight: compact ? 40 : overlay ? 40 : DESIGN_TOKENS.touchTarget.minHeight,
          position: 'relative',
          ...Platform.select({
            web: { cursor: 'pointer' } as any,
            default: {},
          }),
        },
        actionPressed: {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.primary,
        },
        iconWrap: {
          width: compact ? 26 : 30,
          height: compact ? 26 : 30,
          borderRadius: compact ? 13 : 15,
          alignItems: 'center',
          justifyContent: 'center',
        },
        label: {
          fontSize: 11,
          lineHeight: 13,
          fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
          color: colors.text,
        },
        badge: {
          position: 'absolute',
          top: 4,
          right: 8,
          minWidth: 17,
          height: 17,
          borderRadius: DESIGN_TOKENS.radii.pill,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 3,
          borderWidth: 2,
          borderColor: colors.surface,
        },
        badgeText: {
          fontSize: 9,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as any,
          color: colors.textOnDark,
        },
      }),
    [colors, overlay, compact]
  );

  return (
    <View style={styles.row} accessibilityRole="menu">
      {ITEMS.map((item) => {
        const showBadge = item.key === 'messages' && unreadMessagesCount > 0;
        const tone = toneColors[item.tone];
        const isCta = !!item.primaryCta;
        // Главный CTA («Маршрут») — брендовая заливка чипа и белая иконка;
        // остальные — цветная иконка на своей мягкой tone-подложке.
        return (
          <Pressable
            key={item.key}
            onPress={() => onPress(item.key)}
            // Компактные icon-only чипы (~40px) в ряд с узкими зазорами: без hitSlop
            // тап по краю/в зазор попадает в контейнер, а не в кнопку — отклика нет,
            // навигация «залипает». Расширяем тач-зону, вертикаль больше (ряд низкий).
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
            accessibilityRole="menuitem"
            accessibilityLabel={
              showBadge ? `${item.label}, ${unreadMessagesCount} непрочитанных` : item.label
            }
            accessibilityHint={item.accessibilityHint}
            style={({ pressed }) => [
              styles.action,
              isCta && { backgroundColor: colors.brand, borderColor: colors.brand },
              globalFocusStyles.focusable,
              pressed && styles.actionPressed,
              // Мгновенный однозначный отклик на тап независимо от тона/CTA: на
              // frost-подложке смены фона мало заметно, opacity читается всегда.
              pressed && { opacity: 0.6 },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: isCta ? colors.brandAlpha30 : tone.soft },
              ]}
            >
              <Feather
                name={item.icon}
                size={15}
                color={isCta ? colors.textOnPrimary : tone.fg}
              />
            </View>
            {compact ? null : (
              <Text
                style={[styles.label, isCta && { color: colors.textOnPrimary }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            )}
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
