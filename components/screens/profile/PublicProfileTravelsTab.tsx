import { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsiveWidth } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Button from '@/components/ui/Button';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import { CARD_MEDIA_SLOT_RATIO } from '@/components/listTravel/travelListItemHelpers';
import { getMediaPlaceholderData } from '@/utils/travelMediaVariants';
import type { Travel } from '@/types/types';
import { resolveTravelCityName } from '@/utils/travelDisplayLocation';
import { webStyle } from '@/utils/webProps';
import { translate as i18nT } from '@/i18n'


const AUTHOR_CARD_BLURHASH = 'LEHL6nWB2yk8pyo0adR*.7kCMdnj';

/**
 * Ширина карточки в этой сетке резиновая: `cardWrap` живёт на
 * `flexGrow`/`flexBasis`. Точного числа у вкладки нет, а `mediaSlotWidth` идёт
 * ТОЛЬКО в сайзинг растра (#1103) и обязан быть оценкой СВЕРХУ — занижение
 * выбирает мелкую ступень и даёт мыло. На web потолок задаёт `maxWidth`
 * карточки, на native карточка занимает всю строку.
 */
const WEB_CARD_MAX_WIDTH = 460;

/**
 * Минимальная колонка web-сетки. Совпадает с прежним `flexBasis`, поэтому
 * число колонок на всех ширинах остаётся тем же, что до перевода на CSS Grid.
 */
const GRID_MIN_COLUMN_WIDTH = 300;

/**
 * Пол оценки для native. Ноль ширины вьюпорта здесь не ожидается, но фолбэк
 * обязан промахиваться ВВЕРХ: `Math.max(1, …)` превратил бы неизвестную ширину
 * в `?w=1`, то есть в гарантированную кашу вместо просто лишних байт.
 */
const MIN_NATIVE_SLOT_WIDTH = 320;

interface PublicProfileTravelsTabProps {
  travels: Travel[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isMobile: boolean;
  onOpenTravel: (travel: Travel) => void;
  onLoadMore: () => void;
}

export function PublicProfileTravelsTab({
  travels,
  total,
  isLoading,
  isError,
  isMobile,
  onOpenTravel,
  onLoadMore,
}: PublicProfileTravelsTabProps) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Ширина вьюпорта берётся width-only подпиской, а не `useWindowDimensions`:
  // последняя перерисовывает сетку на каждое изменение ВЫСОТЫ окна, то есть на
  // каждом кадре сворачивания адресной строки мобильного браузера, — ровно тот
  // hot scroll path, ради которого `useResponsiveWidth` и существует.
  const viewportWidth = useResponsiveWidth();
  const coverSlotWidth =
    Platform.OS === 'web'
      ? WEB_CARD_MAX_WIDTH
      : Math.max(MIN_NATIVE_SLOT_WIDTH, viewportWidth - DESIGN_TOKENS.spacing.md * 2);

  if (isLoading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="small" color={colors.primaryDark} />
      </View>
    );
  }

  if (isError) {
    return <Text style={styles.stateText}>{i18nT('profile:components.screens.profile.PublicProfileTravelsTab.ne_udalos_zagruzit_puteshestviya_avtora_9b0811fb')}</Text>;
  }

  if (travels.length === 0) {
    return <Text style={styles.stateText}>{i18nT('profile:components.screens.profile.PublicProfileTravelsTab.u_avtora_poka_net_opublikovannyh_puteshestvi_60a70e6a')}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {travels.map((travel, index) => {
          // `cityName` приходит адресом первой точки: в одну строку карточки он
          // не влезает и обрезается на первом же слове, пряча страну.
          const meta = [resolveTravelCityName(travel.cityName), travel.countryName]
            .map((v) => String(v ?? '').trim())
            .filter(Boolean)
            .join(' · ');
          // Карточка кадрирует фото в `contain`, а на web поля letterbox заливает
          // только `dominant_color` из манифеста: blurhash туда не идёт (см.
          // `ImageCardMedia`). Пока сюда уходил один хардкоженый blurhash, фото
          // на web висело на голом фоне карточки. Тот же контракт, что и в
          // `TravelListItem`: цвет — вебу, blurhash — native.
          const coverPlaceholder = getMediaPlaceholderData(travel.media?.cover);
          return (
            <View key={String(travel.id ?? travel.slug ?? index)} style={styles.cardWrap}>
              <UnifiedTravelCard
                title={travel.name?.trim() || i18nT('profile:components.screens.profile.PublicProfileTravelsTab.untitled')}
                imageUrl={travel.travel_image_thumb_url || null}
                metaText={meta || null}
                onPress={() => onOpenTravel(travel)}
                mediaFit="contain"
                heroTitleOverlay
                contentPosition="belowMedia"
                // #1674: медиа-слот держит тот же контракт, что и карточка
                // каталога (`TravelListItem`) — ЕДИНЫЙ квадрат
                // `CARD_MEDIA_SLOT_RATIO`, а не фиксированные 180 px при
                // резиновой ширине. Пиксельная высота на широкой карточке
                // делала слот низким и широким, и квадратная обложка (мода
                // прод-выдачи, 80%) вписывалась в него по высоте, оставляя
                // полосы `dominant_color` сверху и снизу. `contain` остаётся:
                // перевод на `cover` запрещён (`docs/RULES.md` → «Images and
                // placeholders»).
                mediaAspectRatio={CARD_MEDIA_SLOT_RATIO}
                mediaSlotWidth={coverSlotWidth}
                webHoverScale={!isMobile}
                mediaProps={{
                  placeholderBlurhash:
                    coverPlaceholder.blurhash ??
                    (coverPlaceholder.dominantColor ? undefined : AUTHOR_CARD_BLURHASH),
                  placeholderColor: coverPlaceholder.dominantColor,
                  blurBackground: true,
                  allowCriticalWebBlur: Platform.OS === 'web',
                  recyclingKey: String(travel.slug || travel.id || index),
                  loading: Platform.OS === 'web' ? (index < 3 ? 'eager' : 'lazy') : 'lazy',
                  priority: Platform.OS === 'web' && index < 3 ? 'high' : 'low',
                }}
              />
            </View>
          );
        })}
      </View>

      {total > travels.length ? (
        <Button
          label={i18nT('profile:components.screens.profile.PublicProfileTravelsTab.pokazat_esche_4dc205b6')}
          onPress={onLoadMore}
          variant="secondary"
          size="sm"
          icon={<Feather name="chevron-down" size={16} color={colors.primaryDark} />}
          iconPosition="right"
          accessibilityLabel={i18nT('profile:components.screens.profile.PublicProfileTravelsTab.pokazat_esche_puteshestviya_avtora_e98ba901')}
          style={styles.viewAllButton}
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      // #1674: на web сетка — CSS Grid, а не `flex-wrap`. С резиновым
      // `flexGrow` неполный ПОСЛЕДНИЙ ряд растягивался до `maxWidth`, и пока
      // высота медиа была приколочена 180 px, разница ширины не читалась.
      // С квадратным слотом высота следует за шириной, и замер 1700×900
      // (12 карточек, 5 колонок) давал хвост 460×496 против 311.8×347.8 —
      // ряд на 42.6% выше остальных. Это прямо противоречит требованию
      // владельца из #1487 «ровная сетка одинаковых карточек».
      // `repeat(auto-fill, minmax(300px, 1fr))` держит колонки одинаковыми
      // независимо от числа карточек в последнем ряду; тот же приём уже
      // используется в `components/listTravel/listTravelStyles.ts:295-297`.
      ...(Platform.OS === 'web'
        ? webStyle({
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_COLUMN_WIDTH}px, 1fr))`,
            alignItems: 'start',
          })
        : null),
    },
    cardWrap: {
      // Native остаётся на flex-раскладке: одна карточка в строку, растягивать
      // там нечего.
      flexGrow: Platform.OS === 'web' ? 0 : 1,
      flexBasis: Platform.OS === 'web' ? 'auto' : '100%',
      maxWidth: Platform.OS === 'web' ? WEB_CARD_MAX_WIDTH : undefined,
      minWidth: 0,
    },
    state: {
      paddingVertical: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stateText: {
      fontSize: 14,
      color: colors.textMuted,
      paddingVertical: 24,
      textAlign: 'center',
    },
    viewAllButton: {
      marginTop: 16,
      alignSelf: 'flex-start',
    },
  });
