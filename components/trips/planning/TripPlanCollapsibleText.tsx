// components/trips/planning/TripPlanCollapsibleText.tsx
//
// #1844: компактная шапка вкладки «Маршрут» (#1691) обрезает описание поездки до
// двух строк, а логистика — как доехать до старта, как уехать с финиша, номера
// автобусов — живёт в этом же описании. Развернуть текст можно было только
// случайно, переключившись на соседнюю вкладку, где та же шапка рендерится без
// обрезки. Обёртка добавляет к обрезанному тексту кнопку «Показать
// полностью»/«Свернуть» и не трогает контракт `TripPlanLinkedText`: разбор
// ссылок и выделяемость текста остаются там.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import TripPlanLinkedText from '@/components/trips/planning/TripPlanLinkedText';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';

// Описание занимает ширину экрана минус горизонтальные отступы контента (2×16,
// `plannedTripScreen.styles.ts:15`) при `fontSize: 15` — средняя ширина глифа
// пропорционального шрифта ≈0.5em.
const CONTENT_HORIZONTAL_PADDING = 32;
const REFERENCE_FONT_SIZE = 15;
const GLYPH_WIDTH_RATIO = 0.5;
const AVERAGE_GLYPH_WIDTH = REFERENCE_FONT_SIZE * GLYPH_WIDTH_RATIO;
// Компактная шапка живёт на всей мобильной ширине (до планшетного брейкпоинта
// 768), поэтому вместимость строки считается по реальному вьюпорту: на 430dp
// телефоне и в узком окне десктопа фиксированная «телефонная» вместимость
// объявляла бы переполнением текст, который умещается в две строки, и рисовала
// кнопку, ничего не меняющую по нажатию. До гидратации ширина неизвестна —
// тогда берём эталонные 390dp из постановки.
const REFERENCE_VIEWPORT_WIDTH = 390;

export const tripPlanTextCharsPerLine = (viewportWidth: number): number => {
  const width =
    Number.isFinite(viewportWidth) && viewportWidth > CONTENT_HORIZONTAL_PADDING
      ? viewportWidth
      : REFERENCE_VIEWPORT_WIDTH;
  return Math.max(1, Math.floor((width - CONTENT_HORIZONTAL_PADDING) / AVERAGE_GLYPH_WIDTH));
};

/**
 * Вместимость строки текста известной ширины. Нужна там, где текст живёт не на
 * всю ширину контента экрана: описание точки маршрута лежит в карточке панели
 * шириной 380px, и оценка по вьюпорту объявила бы помещающимся в две строки
 * текст, которому в этой колонке нужно полтора десятка.
 */
export const tripPlanTextCharsPerWidth = (contentWidth: number, fontSize: number): number => {
  const width = Number.isFinite(contentWidth) && contentWidth > 0 ? contentWidth : 0;
  const glyphWidth = Math.max(1, fontSize * GLYPH_WIDTH_RATIO);
  return Math.max(1, Math.floor(width / glyphWidth));
};

/**
 * Оценка числа строк по самому тексту: `onTextLayout` в react-native-web не
 * реализован, а мобильный web — основная поверхность этой шапки, поэтому
 * измерить реальную раскладку одинаково на всех платформах нечем.
 *
 * Ошибка оценки безопасна ровно в одну сторону: пока текст считается
 * помещающимся, он рендерится БЕЗ `numberOfLines` — недооценка длины даёт лишнюю
 * высоту шапки, но никогда не прячет текст без кнопки разворота.
 */
export const estimateTripPlanTextLines = (text: string, charsPerLine: number): number =>
  text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.trim().length / charsPerLine)), 0);

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  /** Предел строк в свёрнутом состоянии; `undefined` — текст не обрезается и кнопки нет. */
  numberOfLines?: number;
  /**
   * Готовая вместимость строки (`tripPlanTextCharsPerWidth`). Передаётся, когда
   * ширина текста известна и не равна ширине контента экрана; без неё
   * вместимость считается по вьюпорту.
   */
  charsPerLine?: number;
  testID?: string;
  /** Свой testID кнопки: в списке точек компонент рендерится по разу на точку. */
  toggleTestID?: string;
}

function TripPlanCollapsibleText({
  text,
  style,
  linkStyle,
  numberOfLines,
  charsPerLine,
  testID,
  toggleTestID = 'trip-plan-description-toggle',
}: Props) {
  const colors = useThemedColors();
  const { width } = useResponsive();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  // Разворот — состояние просмотра, а не поездки: другое описание (переход к
  // другой поездке) открывается снова свёрнутым.
  useEffect(() => {
    setExpanded(false);
  }, [text]);

  const lineCapacity = charsPerLine ?? tripPlanTextCharsPerLine(width);
  const overflows =
    numberOfLines !== undefined &&
    estimateTripPlanTextLines(text, lineCapacity) > numberOfLines;
  const collapsed = overflows && !expanded;
  const toggle = useCallback(() => setExpanded((value) => !value), []);

  return (
    <>
      <TripPlanLinkedText
        text={text}
        style={style}
        linkStyle={linkStyle}
        numberOfLines={collapsed ? numberOfLines : undefined}
        testID={testID}
      />
      {overflows ? (
        <Pressable
          onPress={toggle}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          testID={toggleTestID}
        >
          <Text style={styles.toggleLabel}>
            {expanded
              ? t('tripsStatic:plan.description.collapse')
              : t('tripsStatic:plan.description.expand')}
          </Text>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.primaryDark}
          />
        </Pressable>
      ) : null}
    </>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      // 12 + 20 + 12 = 44dp тач-таргета под пальцем в дороге
      paddingVertical: 12,
      paddingRight: 8,
    },
    toggleLabel: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: colors.primaryDark,
    },
  });

export default React.memo(TripPlanCollapsibleText);
