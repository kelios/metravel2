import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Platform,
  PixelRatio,
  StyleSheet,
  Image as RNImage,
  Pressable,
} from "react-native";
import { CustomRendererProps } from "react-native-render-html";
import { useResponsive } from '@/hooks/useResponsive';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useRichMediaVisibility } from '@/components/ui/richMediaViewport';
import { optimizeImageUrl } from '@/utils/imageProxy';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface CustomImageRendererProps extends CustomRendererProps<any> {
  contentWidth: number;
  tnode: any;
  onPressImage?: (image: { src: string; alt: string }) => void;
}

const MAX_WIDTH = 800;
const MAX_IMAGE_HEIGHT = 480;
const H_PADDING = 16;

/**
 * Web-гейт для измерительного запроса (#1114).
 *
 * `useRichMediaVisibility` намеренно выключен на web (там ленивость даёт сам
 * `<img loading="lazy">`), поэтому для web нужен собственный признак «рамка близко
 * к вьюпорту». Гейт НИЧЕГО не скрывает: рамка и `<img>` рендерятся как прежде, с
 * зарезервированной высотой — под гейтом только measure-запрос, который иначе
 * стартовал бы немедленно для всех фото статьи и обходил браузерную ленивость.
 *
 * Без IntersectionObserver (SSR, старые движки) возвращает `true` — поведение
 * прежнее.
 */
const WEB_MEASURE_ROOT_MARGIN = '150% 0px';

function useWebMeasureGate(frameRef: React.RefObject<any>, enabled: boolean): boolean {
  const [near, setNear] = useState(() => Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return undefined;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const node = frameRef.current as unknown as Element | null;
    if (!node || typeof node !== 'object' || !('nodeType' in node)) {
      setNear(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: WEB_MEASURE_ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, frameRef]);

  return near;
}

/* ─ helpers ─ */
const pickSrc = (tnode: any) => {
  const a = tnode?.attributes || {};
  const raw = a.src || a["data-src"] || "";
  if (!raw && a.srcset) {
    const first = String(a.srcset).split(",")[0]?.trim().split(/\s+/)[0];
    return first || "";
  }
  return raw;
};

const isPrivateHost = (host: string) =>
  host === "localhost" ||
  host.endsWith(".local") ||
  /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

const normalizeUrl = (url: string) => {
  let u = (url || "").trim();
  if (!u) return u;
  if (u.startsWith("//")) {
    const proto = typeof window !== "undefined" ? window.location.protocol : "https:";
    u = `${proto}${u}`;
  }
  try {
    const parsed = new URL(u, typeof window !== "undefined" ? window.location.href : "http://localhost");
    if (!isPrivateHost(parsed.hostname) && parsed.protocol === "http:") {
      parsed.protocol = "https:";
      return parsed.toString();
    }
    return parsed.toString();
  } catch { return u; }
};

/* ─ component ─ */
const CustomImageRenderer = ({ tnode, contentWidth, onPressImage }: CustomImageRendererProps) => {
  const colors = useThemedColors();
  const raw = pickSrc(tnode);
  const attW = tnode.attributes?.width ? Number(tnode.attributes.width) : undefined;
  const attH = tnode.attributes?.height ? Number(tnode.attributes.height) : undefined;
  const isSmallIcon = (attW && attW <= 32) || (attH && attH <= 32);
  const attrAR = attW && attH && attH > 0 ? attW / attH : null;
  const { width: screenWidth, height: screenHeight } = useResponsive();
  const src = useMemo(() => (raw ? normalizeUrl(raw) : ''), [raw]);
  const maxImageHeight = useMemo(
    () =>
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? Math.max(240, Math.floor(window.innerHeight * 0.7))
        : Math.max(MAX_IMAGE_HEIGHT, Math.floor(screenHeight * 0.7)),
    [screenHeight]
  );
  const maxFrameWidth = useMemo(
    () => Math.min(contentWidth || screenWidth || MAX_WIDTH, MAX_WIDTH, (screenWidth || MAX_WIDTH) - H_PADDING * 2),
    [contentWidth, screenWidth]
  );

  const [ar, setAr] = useState<number | null>(attrAR ?? null);
  const [err, setErr] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const aspect = ar && ar > 0 ? ar : 16 / 9;

  const { boxWidth, boxHeight } = useMemo(() => {
    const heightIfFullWidth = maxFrameWidth / aspect;
    return {
      // Keep the media frame dominant even for very tall photos. The image stays
      // `contain`, while the shared blurred surround fills the remaining width.
      boxWidth: maxFrameWidth,
      boxHeight: Math.min(heightIfFullWidth, maxImageHeight),
    };
  }, [maxFrameWidth, aspect, maxImageHeight]);

  // Уменьшенный вариант фото тела статьи — на ОБЕИХ платформах.
  //
  // #1114: на web этой ветки не было вовсе (`Platform.OS === 'web'` возвращал сырой
  // `src`), а ImageCardMedia ниже получает только `style`, без числовых width/height,
  // поэтому и он оставлял URL как есть. Итог: каждое фото статьи приезжало
  // ОРИГИНАЛОМ. Замер прода 2026-07-28 на `-detail_hd.jpg`:
  //   без параметров        → 219 996 B, TTFB 2.33 с
  //   `?w=800&q=75&fit=contain` →  77 346 B, TTFB 1.15 с
  // На статье с 37 фото это 8.1 МБ против 2.8 МБ.
  //
  // Ширину капим на MAX_WIDTH (800) — это и рамка компонента, и ступень whitelist
  // прокси. Просить boxWidth × DPR смысла нет: 1600 прокси отдаёт апскейлом тяжелее
  // оригинала, а 800 на мобильной рамке ~361dp — это и так DPR ≈ 2.2.
  // Высоту не передаём: прокси её игнорирует, а её попадание в URL делало ссылку
  // зависимой от измеренных пропорций (см. AR-эффект ниже) и давало второй запрос.
  const displaySrc = useMemo(() => {
    if (!src) return src;
    const dpr = Platform.OS === 'web' ? 2 : PixelRatio.get();
    return (
      optimizeImageUrl(src, {
        width: Math.min(MAX_WIDTH, Math.round(boxWidth * dpr)),
        quality: 70,
        fit: 'contain',
        format: 'auto',
      }) ?? src
    );
  }, [src, boxWidth]);

  // Дальние от вьюпорта фото тела статьи не монтируем: на native у expo-image нет
  // lazy-загрузки по вьюпорту, поэтому все 90+ картинок статьи декодируются сразу,
  // вытесняют друг друга из bitmap-кэша и Android грузит текстуры на каждом кадре
  // скролла (#1035). Рамка остаётся той же высоты — сдвига вёрстки нет.
  const { ref: frameRef, visible: isNearViewport, onLayout: handleFrameLayout } =
    useRichMediaVisibility(boxHeight);
  const shouldRenderMedia = Platform.OS === 'web' || isNearViewport;

  const needsMeasure = Boolean(src) && !isSmallIcon && !attrAR;
  const isWebFrameNearViewport = useWebMeasureGate(frameRef, needsMeasure);
  const canMeasure = Platform.OS === 'web' ? isWebFrameNearViewport : isNearViewport;

  // Пропорции измеряем по ТОМУ ЖЕ файлу, который покажет ImageCardMedia, и только
  // когда фото уже рядом с вьюпортом.
  //
  // #1114: раньше здесь безусловно создавался `new Image()` с сырым `src` и грузился
  // полноразмерный `-detail_hd.jpg`. `loading = 'lazy'` на detached-объекте браузер
  // игнорирует, поэтому проба обходила ленивость `<img>` внутри ImageCardMedia и
  // стартовала для ВСЕХ фото статьи сразу — 37 оригиналов одним залпом. Теперь
  // измеряется уже уменьшенный `displaySrc`, и только для фото у вьюпорта.
  useEffect(() => {
    let mounted = true;

    if (!displaySrc || isSmallIcon) {
      return () => {
        mounted = false;
      };
    }

    if (attrAR) {
      setAr(attrAR);
      return () => {
        mounted = false;
      };
    }

    // Измерение — это сетевой запрос, поэтому оно ждёт приближения к вьюпорту:
    // на native — общий гейт #1035, на web — локальный IntersectionObserver.
    if (!canMeasure) {
      return () => {
        mounted = false;
      };
    }

    if (Platform.OS === "web") {
      const img = new (window as any).Image();
      (img as any).decoding = "async";
      img.onload = () => {
        if (mounted && img.naturalWidth && img.naturalHeight) {
          setAr(img.naturalWidth / img.naturalHeight);
        }
      };
      img.onerror = () => {
        if (mounted) setAr(null);
      };
      img.src = displaySrc;
      return () => {
        mounted = false;
      };
    }

    RNImage.getSize(
      displaySrc,
      (w, h) => {
        if (mounted && h > 0) setAr(w / h);
      },
      () => {
        if (mounted) setAr(null);
      }
    );

    return () => {
      mounted = false;
    };
  }, [displaySrc, attrAR, isSmallIcon, canMeasure]);

  if (!raw || isSmallIcon) return null;

  const alt = tnode.attributes?.alt || i18nT('sharedStatic:image.travelAlt');
  const isPressable = Boolean(onPressImage && src);

  const imageContent = (
    <View
      ref={frameRef}
      onLayout={handleFrameLayout}
      collapsable={false}
      style={{ width: boxWidth, height: boxHeight, position: 'relative' }}
    >
      {(!shouldRenderMedia || !imageLoaded) && !err && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.skeleton,
            { backgroundColor: colors.mutedBackground },
            { pointerEvents: 'none' } as any,
          ]}
        >
          <View style={[styles.placeholder, { width: boxWidth, height: boxHeight, backgroundColor: colors.backgroundSecondary }]} />
        </View>
      )}

      {shouldRenderMedia && (
        <ImageCardMedia
          src={displaySrc}
          alt={alt}
          fit="contain"
          blurBackground
          allowCriticalWebBlur
          // `displaySrc` — уже финальный вариант (w=800). Без этого флага
          // ImageCardMedia на iOS Safari пересобрал бы из него собственный srcSet
          // и браузер скачал бы вторую, иначе нарезанную копию того же фото.
          preserveOptimizedWebSrc
          blurRadius={16}
          // Native: подложка блюра берёт тот же файл (лишнего запроса нет), но
          // декодируется в 128px — FastBlur крутится по 16 тыс. пикселей вместо
          // 0.8 млн, и вторая полноразмерная битмапа на каждое фото не создаётся.
          blurSrc={Platform.OS === 'web' ? undefined : displaySrc}
          blurDecodeSize={128}
          priority={Platform.OS === 'web' ? 'low' : 'normal'}
          loading={Platform.OS === 'web' ? 'lazy' : 'lazy'}
          transition={Platform.OS === 'web' ? undefined : 120}
          style={[StyleSheet.absoluteFillObject, styles.image]}
          onLoad={() => { setImageLoaded(true); }}
          onError={() => { setErr(true); }}
        />
      )}

      {err && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.errorContainer,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { width: boxWidth }]}> 
      {isPressable ? (
        <Pressable
          onPress={() => onPressImage?.({ src, alt })}
          accessibilityRole="button"
          accessibilityLabel={i18nT('shared:components.ui.CustomImageRenderer.otkryt_izobrazhenie_value1_f6c52942', { value1: alt })}
        >
          {imageContent}
        </Pressable>
      ) : imageContent}
    </View>
  );
};

export default React.memo(CustomImageRenderer);

/* ─ styles ─ */
const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: "center",
    paddingHorizontal: H_PADDING,
    ...Platform.select({
      web: {
        contain: 'layout style paint',
      } as any,
    }),
  },
  image: {
    borderRadius: 8,
    ...(Platform.OS === "web"
      ? ({ transition: "opacity 0.3s ease-in-out" } as any)
      : null),
  },
  skeleton: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  placeholder: {
    borderRadius: 8,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});
