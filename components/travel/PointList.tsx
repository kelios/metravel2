// components/travel/PointList.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  useWindowDimensions,
  Pressable,
  Text,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Image as ExpoImage } from 'expo-image';
import {
  MapPinned,
  ChevronUp,
  ChevronDown,
  Copy,
  Send,
  Map,
  Link as LinkIcon,
} from 'lucide-react-native';

type Point = {
  id: string;
  travelImageThumbUrl?: string;
  updated_at?: string;
  address: string;
  coord: string;
  categoryName?: string;
  description?: string;
};

type PointListProps = { points: Point[] };

type Responsive = {
  imageMinHeight: number;
  titleSize: number;
  coordSize: number;
};

/* ---------------- helpers ---------------- */

const getOptimizedImageUrl = (url?: string, updatedAt?: string) => {
  if (!url) return undefined;
  const ts = updatedAt ? Date.parse(updatedAt) : undefined;
  const hasQ = url.includes('?');
  const params = `auto=format&fit=crop&w=960&h=640&q=82${ts && Number.isFinite(ts) ? `&v=${ts}` : ''}`;
  return `${url}${hasQ ? '&' : '?'}${params}`;
};

const parseCoord = (coordStr: string): { lat: number; lon: number } | null => {
  if (!coordStr) return null;
  const cleaned = coordStr.replace(/;/g, ',').replace(/\s+/g, '');
  const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

const buildMapUrl = (coordStr: string) => {
  const p = parseCoord(coordStr);
  if (!p) return '';
  const { lat, lon } = p;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
};

const openExternal = async (url: string) => {
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch {}
};

/* квадратная тёмная плашка-иконка */
const DarkSquareBtn = React.memo(function DarkSquareBtn({
                                                          Icon,
                                                          onPress,
                                                          label,
                                                        }: {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={styles.darkSquare}
      onPress={onPress}
      accessibilityLabel={label}
      activeOpacity={0.85}
    >
      <Icon size={20} color="#fff" />
    </TouchableOpacity>
  );
});

/* ---------------- card ---------------- */

const PointCard = React.memo(function PointCard({
                                                  point,
                                                  isMobile,
                                                  responsive,
                                                  onCopy,
                                                  onShare,
                                                  onOpenMap,
                                                }: {
  point: Point;
  isMobile: boolean;
  responsive: Responsive;
  onCopy: (coordStr: string) => void;
  onShare: (coordStr: string) => void;
  onOpenMap: (coordStr: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const imgUri = getOptimizedImageUrl(point.travelImageThumbUrl, point.updated_at);

  const openMapFromLink = useCallback(() => onOpenMap(point.coord), [onOpenMap, point.coord]);
  const showBottomBar = isMobile || hovered;

  return (
    <View
      style={styles.card}
      onMouseEnter={() => !isMobile && setHovered(true)}
      onMouseLeave={() => !isMobile && setHovered(false)}
    >
      <Pressable onPress={openMapFromLink} style={styles.cardPressable}>
        <View style={[styles.imageWrap, { minHeight: responsive.imageMinHeight }]}>
          {imgUri ? (
            <ExpoImage
              source={{ uri: imgUri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              priority="low"
            />
          ) : (
            <View style={[styles.noImage, { minHeight: responsive.imageMinHeight }]}>
              <Map size={44} color="#1f2937" />
              <Text style={styles.noImageText} numberOfLines={2}>
                {point.address}
              </Text>
            </View>
          )}

          {/* верхние кнопки */}
          <View pointerEvents="box-none" style={styles.topRightWrap}>
            <View style={styles.topRightStack}>
              <DarkSquareBtn Icon={LinkIcon} onPress={openMapFromLink} label="Открыть в картах" />
              <DarkSquareBtn Icon={Copy} onPress={() => onCopy(point.coord)} label="Скопировать координаты" />
              <DarkSquareBtn Icon={Send} onPress={() => onShare(point.coord)} label="Поделиться в Telegram" />
            </View>
          </View>

          {/* нижняя плашка (мобайл всегда, десктоп — по hover) */}
          {showBottomBar && (
            <View style={styles.bottomBar}>
              <Text style={[styles.titleText, { fontSize: responsive.titleSize }]} numberOfLines={1}>
                {point.address}
              </Text>

              <Text
                style={[styles.coordLink, { fontSize: responsive.coordSize }]}
                onPress={openMapFromLink}
                numberOfLines={1}
              >
                {point.coord}
              </Text>

              {!!point.categoryName && (
                <View style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{point.categoryName.split(',')[0]?.trim()}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
});

/* ---------------- list ---------------- */

const PointList: React.FC<PointListProps> = ({ points }) => {
  const safePoints = useMemo(() => (Array.isArray(points) ? points : []), [points]);
  const { width } = useWindowDimensions();
  const isMobile = width <= 480;

  const [showList, setShowList] = useState(false);

  const responsive: Responsive = useMemo(
    () => ({
      imageMinHeight: width >= 1200 ? 520 : width >= 768 ? 420 : 320,
      titleSize: isMobile ? 16 : 18,
      coordSize: isMobile ? 14 : 15,
    }),
    [isMobile, width]
  );

  const onCopy = useCallback(async (coordStr: string) => {
    try {
      if (Platform.OS === 'web' && (navigator as any)?.clipboard) {
        await (navigator as any).clipboard.writeText(coordStr);
      } else {
        await Clipboard.setStringAsync(coordStr);
      }
    } catch {}
  }, []);

  // ✅ исправленный Telegram share
  const onShare = useCallback(async (coordStr: string) => {
    const mapUrl = buildMapUrl(coordStr);
    const text = `📍 Координаты: ${coordStr}`;

    // 1) пытаемся открыть приложение Telegram
    const tgDeepLinks = [
      `tg://msg_url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`,
      `tg://share?text=${encodeURIComponent(`${text}\n${mapUrl}`)}`,
    ];

    for (const deeplink of tgDeepLinks) {
      try {
        const can = await Linking.canOpenURL(deeplink);
        if (can) {
          await Linking.openURL(deeplink);
          return;
        }
      } catch {}
    }

    // 2) веб-фолбэк
    const webShare = `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`;
    openExternal(webShare);
  }, []);

  const onOpenMap = useCallback((coordStr: string) => {
    const url = buildMapUrl(coordStr);
    if (url) openExternal(url);
  }, []);

  const numColumns = width >= 1200 ? 3 : width >= 768 ? 2 : 1;

  const keyExtractor = useCallback((item: Point) => item.id, []);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Point>) => (
      <View
        style={[
          styles.col,
          numColumns === 3 ? styles.col3 : numColumns === 2 ? styles.col2 : styles.col1,
        ]}
      >
        <PointCard
          point={item}
          isMobile={isMobile}
          responsive={responsive}
          onCopy={onCopy}
          onShare={onShare}
          onOpenMap={onOpenMap}
        />
      </View>
    ),
    [isMobile, numColumns, onCopy, onOpenMap, onShare, responsive]
  );

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setShowList((p) => !p)}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
      >
        <View style={styles.toggleRow}>
          <MapPinned size={22} color="#334155" />
          <Text style={[styles.toggleText, isMobile && styles.toggleTextSm]}>
            {showList ? 'Скрыть координаты мест' : 'Показать координаты мест'}
          </Text>
          {showList ? <ChevronUp size={18} color="#334155" /> : <ChevronDown size={18} color="#334155" />}
        </View>
      </Pressable>

      {showList && (
        <FlatList
          key={`cols-${numColumns}`}            // ← фикс "Changing numColumns..."
          data={safePoints}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={numColumns}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={numColumns * 3}
          maxToRenderPerBatch={numColumns * 3}
          updateCellsBatchingPeriod={16}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
        />
      )}
    </View>
  );
};

export default React.memo(PointList);

/* ============================= styles ============================= */

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginTop: 16 },

  toggle: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  togglePressed: { backgroundColor: '#f8fafc' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleText: { fontSize: 17, fontWeight: '600', color: '#1f2937' },
  toggleTextSm: { fontSize: 16 },

  listContent: { paddingBottom: 20 },
  columnWrap: { justifyContent: 'space-between' },

  col: { marginBottom: 14 },
  col3: { width: '32%' },
  col2: { width: '48%' },
  col1: { width: '100%' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardPressable: { flex: 1 },

  imageWrap: { position: 'relative', width: '100%' },
  image: { width: '100%', height: '100%', minHeight: 320, display: 'block' },

  noImage: {
    width: '100%',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 24,
  },
  noImageText: {
    marginTop: 10,
    maxWidth: '85%',
    textAlign: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  topRightWrap: { position: 'absolute', top: 10, right: 10 },
  topRightStack: { flexDirection: 'column', gap: 10, alignItems: 'flex-end' },
  darkSquare: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.66)',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  titleText: { color: '#fff', fontWeight: '800', marginBottom: 6 },
  coordLink: {
    color: '#fff',
    textDecorationLine: 'underline',
    textDecorationColor: '#fff' as any, // RN Web
    fontWeight: '700',
    marginBottom: 8,
  },
  tagChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagChipText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
