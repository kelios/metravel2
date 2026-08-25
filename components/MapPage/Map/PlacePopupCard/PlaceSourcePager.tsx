/**
 * PlaceSourcePager — перелистывание материалов одного физического места (#1572).
 *
 * Контракт (`docs/features/map.md` → «Один физический объект с несколькими
 * источниками»): у места с несколькими статьями карточка одна, а фото/заголовок/
 * ссылка принадлежат активному источнику. Место с одним источником НЕ показывает
 * ни счётчика, ни кнопок — карточка выглядит ровно как прежде.
 *
 * Визуально pager живёт на самом фото: счётчик — сверху по центру, стрелки — по
 * боковым краям. Углы hero заняты (♥ слева сверху, ✕/⤢ справа, caption снизу),
 * поэтому боковые края — единственная свободная зона без наложений.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import CardActionPressable from '@/components/ui/CardActionPressable';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n';
import { formatInteger } from '@/i18n/format';

const IS_WEB = Platform.OS === 'web';

// Порог горизонтального свайпа. Вертикальные жесты остаются у карточки
// (swipe-down-to-close в MapPlaceBottomCard), поэтому оба хендлера требуют
// доминирования своей оси и не конкурируют за один жест.
const SWIPE_PAGE_THRESHOLD_PX = 48;

/** Статический тёмный фрост как у ⤢: живой blur на мобиле не используем. */
const PILL_BACKGROUND = 'rgba(15,23,42,0.58)';

/** Минимальный touch target контракта (#1572) — он же диаметр кнопки. */
const PAGER_BUTTON_SIZE = 44;

export type PlaceSourcePagerLabels = {
  counter: string;
  previous: string;
  next: string;
  announcement: string;
};

/**
 * Локализованные подписи pager'а. Числа проходят через `formatInteger`
 * (locale-sensitive formatting, guard `numeric-translation-argument`).
 * Заголовок активного материала — source-owned поле, поэтому он входит и в
 * видимую подпись, и в анонс для ассистивных технологий.
 */
export const getPlaceSourcePagerLabels = (
  currentIndex: number,
  total: number,
  articleTitle?: string | null,
): PlaceSourcePagerLabels => {
  const current = formatInteger(currentIndex + 1);
  const totalLabel = formatInteger(total);
  const counter = i18nT('map:components.MapPage.Map.PlacePopupCard.PlaceSourcePager.material_current_iz_total_5f5f1d3a', {
    current,
    total: totalLabel,
  });
  const title = String(articleTitle ?? '').trim();
  return {
    counter,
    previous: i18nT('map:components.MapPage.Map.PlacePopupCard.PlaceSourcePager.predyduschiy_material_1c6a0f27'),
    next: i18nT('map:components.MapPage.Map.PlacePopupCard.PlaceSourcePager.sleduyuschiy_material_ab7f8c04'),
    announcement: title ? `${counter}, ${title}` : counter,
  };
};

type Props = {
  /** Число материалов места. `<= 1` — pager не рендерится вовсе. */
  total: number;
  /** Индекс активного материала (0-based). */
  currentIndex: number;
  /** Заголовок активного материала: меняется вместе с фото и ссылкой. */
  articleTitle?: string | null;
  onPrev: () => void;
  onNext: () => void;
  colors: ThemedColors;
  compact?: boolean;
  /**
   * Материал без фото: hero-контейнера нет, поэтому pager рисуется строкой в
   * потоке карточки, а не поверх фото. Без этого варианта пользователь остался
   * бы без стрелок и не смог бы вернуться к материалу с фото.
   */
  inline?: boolean;
};

const PlaceSourcePager: React.FC<Props> = ({
  total,
  currentIndex,
  articleTitle,
  onPrev,
  onNext,
  colors,
  compact = false,
  inline = false,
}) => {
  const labels = useMemo(
    () => getPlaceSourcePagerLabels(currentIndex, total, articleTitle),
    [articleTitle, currentIndex, total],
  );

  // Смена материала объявляется ассистивным технологиям. Web и Android получают
  // её от live-region (`accessibilityLiveRegion` react-native-web мапит в
  // `aria-live`), у VoiceOver такого механизма нет — только явный анонс.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (Platform.OS !== 'ios' || total <= 1) return;
    AccessibilityInfo.announceForAccessibility?.(labels.announcement);
  }, [labels.announcement, total]);

  const styles = useMemo(() => createStyles(compact), [compact]);

  if (total <= 1) return null;

  const glyphSize = PAGER_BUTTON_SIZE / 2;
  const title = String(articleTitle ?? '').trim();

  const label = (
    // Live-region на обёртке, а не на счётчике: иначе web и Android объявляли бы
    // только «Материал 2 из 2», тогда как iOS-анонс несёт ещё и заголовок.
    <View
      style={inline ? styles.inlineLabel : styles.counterPill}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[styles.counterText, { color: colors.textOnDark }]}
        numberOfLines={1}
        testID="place-source-pager-counter"
      >
        {labels.counter}
      </Text>
      {title ? (
        <Text
          style={[styles.sourceTitleText, { color: colors.textOnDark }]}
          numberOfLines={1}
          testID="place-source-pager-title"
        >
          {title}
        </Text>
      ) : null}
    </View>
  );

  const prevControl = (
    <CardActionPressable
      accessibilityLabel={labels.previous}
      accessibilityRole="button"
      onPress={onPrev}
      title={labels.previous}
      testID="place-source-pager-prev"
      enableWebClickFallback
      style={({ pressed }) => [styles.pagerButton, pressed && styles.pagerButtonPressed]}
    >
      <Feather name="chevron-left" size={glyphSize} color={colors.textOnDark} />
    </CardActionPressable>
  );

  const nextControl = (
    <CardActionPressable
      accessibilityLabel={labels.next}
      accessibilityRole="button"
      onPress={onNext}
      title={labels.next}
      testID="place-source-pager-next"
      enableWebClickFallback
      style={({ pressed }) => [styles.pagerButton, pressed && styles.pagerButtonPressed]}
    >
      <Feather name="chevron-right" size={glyphSize} color={colors.textOnDark} />
    </CardActionPressable>
  );

  if (inline) {
    return (
      <View style={styles.inlineRoot} testID="place-source-pager">
        {prevControl}
        {label}
        {nextControl}
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="box-none" testID="place-source-pager">
      {label}
      <View style={styles.sideControls} pointerEvents="box-none">
        {prevControl}
        {nextControl}
      </View>
    </View>
  );
};

/**
 * Горизонтальный свайп по фото — ТОЛЬКО native.
 *
 * На web свайпа здесь нет и быть не может: `usePopupDomGuard` вешает на корень
 * карточки нативные listeners на `pointerdown/pointerup/touch*` и безусловно
 * зовёт `stopPropagation()` (`POPUP_DOM_EVENTS` в `domEvents.ts`), а React
 * слушает те же события на корне приложения — значит React-пропы
 * `onPointerDown/onPointerUp` внутри карточки не диспатчатся вовсе. Плюс сам
 * hero открывает полноэкранное фото по тапу, так что жест по фото был бы
 * двусмысленным. Перелистывание на web выполняют явные кнопки ‹ › (44 dp, с
 * клавиатуры); менять guard карточки или жест открытия фото — отдельная задача.
 *
 * На native PanResponder отличает протяжку от тапа сам и берёт только явно
 * горизонтальный жест, поэтому swipe-down-to-close карточки не задет.
 */
export const usePlaceSourceSwipeHandlers = (
  enabled: boolean,
  onPrev: () => void,
  onNext: () => void,
) => {
  const applyDelta = useCallback(
    (dx: number) => {
      if (dx <= -SWIPE_PAGE_THRESHOLD_PX) onNext();
      else if (dx >= SWIPE_PAGE_THRESHOLD_PX) onPrev();
    },
    [onNext, onPrev],
  );

  const nativeResponder = useMemo(() => {
    if (IS_WEB || !enabled) return null;
    return PanResponder.create({
      // Только явно горизонтальный жест: вертикаль остаётся swipe-down-to-close.
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_evt, gesture) => applyDelta(gesture.dx),
      onPanResponderTerminate: () => undefined,
    });
  }, [applyDelta, enabled]);

  return nativeResponder?.panHandlers ?? null;
};

const createStyles = (compact: boolean) => {
  const size = PAGER_BUTTON_SIZE;
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 8,
    },
    counterPill: {
      position: 'absolute',
      top: compact ? 8 : 10,
      alignSelf: 'center',
      maxWidth: '76%',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: PILL_BACKGROUND,
    },
    // Материал без фото: pager живёт строкой в потоке карточки.
    inlineRoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: compact ? 10 : 12,
      paddingVertical: compact ? 6 : 8,
    },
    inlineLabel: {
      flexShrink: 1,
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: PILL_BACKGROUND,
    },
    counterText: {
      fontSize: compact ? 11 : 12,
      fontWeight: '600',
    },
    sourceTitleText: {
      fontSize: compact ? 11 : 12,
      fontWeight: '400',
      opacity: 0.92,
    },
    sideControls: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      marginTop: -size / 2,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: compact ? 4 : 6,
    },
    pagerButton: {
      width: size,
      height: size,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: PILL_BACKGROUND,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pagerButtonPressed: {
      backgroundColor: 'rgba(15,23,42,0.85)',
      transform: [{ scale: 0.94 }],
    },
  });
};

export default React.memo(PlaceSourcePager);
