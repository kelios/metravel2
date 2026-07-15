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

  useEffect(() => {
    let mounted = true;

    if (!src || isSmallIcon) {
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

    if (Platform.OS === "web") {
      const img = new (window as any).Image();
      (img as any).decoding = "async";
      (img as any).loading = "lazy";
      img.onload = () => {
        if (mounted && img.naturalWidth && img.naturalHeight) {
          setAr(img.naturalWidth / img.naturalHeight);
        }
      };
      img.onerror = () => {
        if (mounted) setAr(null);
      };
      img.src = src;
      return () => {
        mounted = false;
      };
    }

    RNImage.getSize(
      src,
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
  }, [src, attrAR, isSmallIcon]);

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

  // На web ImageCardMedia сам ресайзит URL под размер (+srcSet по DPR); на native
  // этого не происходит — expo-image тянет оригинал (напр. 2048px) в контейнер ~360px
  // и Glide долго декодит тяжёлый файл, залипая на blur. Отдаём заранее уменьшенный
  // под boxWidth×DPR URL (contain, без кропа — фото остаётся доминантой).
  const displaySrc = useMemo(() => {
    if (Platform.OS === 'web' || !src) return src;
    const dpr = PixelRatio.get();
    return (
      optimizeImageUrl(src, {
        width: Math.round(boxWidth * dpr),
        height: Math.round(boxHeight * dpr),
        quality: 70,
        fit: 'contain',
        format: 'auto',
      }) ?? src
    );
  }, [src, boxWidth, boxHeight]);

  if (!raw || isSmallIcon) return null;

  const alt = tnode.attributes?.alt || i18nT('sharedStatic:image.travelAlt');
  const isPressable = Boolean(onPressImage && src);

  const imageContent = (
    <View style={{ width: boxWidth, height: boxHeight, position: 'relative' }}>
      {!imageLoaded && !err && (
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

      <ImageCardMedia
        src={displaySrc}
        alt={alt}
        fit="contain"
        blurBackground
        allowCriticalWebBlur
        blurRadius={16}
        priority={Platform.OS === 'web' ? 'low' : 'normal'}
        loading={Platform.OS === 'web' ? 'lazy' : 'lazy'}
        transition={Platform.OS === 'web' ? undefined : 120}
        style={[StyleSheet.absoluteFillObject, styles.image]}
        onLoad={() => { setImageLoaded(true); }}
        onError={() => { setErr(true); }}
      />

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
