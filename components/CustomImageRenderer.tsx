import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Platform,
  useWindowDimensions,
  StyleSheet,
  Image as RNImage,
  Text,
} from "react-native";
import { CustomRendererProps } from "react-native-render-html";
import { Image as ExpoImage } from "expo-image";

interface CustomImageRendererProps extends CustomRendererProps<any> {
  contentWidth: number;
  tnode: any;
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
const CustomImageRenderer = ({ tnode, contentWidth }: CustomImageRendererProps) => {
  const raw = pickSrc(tnode);
  if (!raw) return null;

  const src = useMemo(() => normalizeUrl(raw), [raw]);

  const attW = tnode.attributes?.width ? Number(tnode.attributes.width) : undefined;
  const attH = tnode.attributes?.height ? Number(tnode.attributes.height) : undefined;

  // 🔎 если это мелкая иконка — игнорируем (даёт «белые квадраты» и ломает тексты)
  if ((attW && attW <= 32) || (attH && attH <= 32)) {
    return null;
  }

  const attrAR = attW && attH && attH > 0 ? attW / attH : null;

  const { width: winW } = useWindowDimensions();
  const maxFrameWidth = useMemo(
    () => Math.min(contentWidth || winW || MAX_WIDTH, MAX_WIDTH, (winW || MAX_WIDTH) - H_PADDING * 2),
    [contentWidth, winW]
  );

  const [ar, setAr] = useState<number | null>(attrAR ?? null);
  const [err, setErr] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (attrAR) { setAr(attrAR); return () => { mounted = false; }; }

    if (Platform.OS === "web") {
      const img = new (window as any).Image();
      (img as any).decoding = "async";
      (img as any).loading = "lazy";
      img.onload = () => { if (mounted && img.naturalWidth && img.naturalHeight) setAr(img.naturalWidth / img.naturalHeight); };
      img.onerror = () => { if (mounted) setAr(null); };
      img.src = src;
      return () => { mounted = false; };
    }

    RNImage.getSize(
      src,
      (w, h) => { if (mounted && h > 0) setAr(w / h); },
      () => { if (mounted) setAr(null); }
    );

    return () => { mounted = false; };
  }, [src, attrAR]);

  const aspect = ar && ar > 0 ? ar : 16 / 9;

  const { boxWidth, boxHeight } = useMemo(() => {
    const heightIfFullWidth = maxFrameWidth / aspect;
    if (heightIfFullWidth > MAX_IMAGE_HEIGHT) {
      return { boxWidth: MAX_IMAGE_HEIGHT * aspect, boxHeight: MAX_IMAGE_HEIGHT };
    }
    return { boxWidth: maxFrameWidth, boxHeight: heightIfFullWidth };
  }, [maxFrameWidth, aspect]);

  // ✅ FIX: Убрали fetchpriority из webAttrs, так как ExpoImage не поддерживает этот проп
  // Для веба ExpoImage использует priority prop вместо fetchpriority
  const webAttrs =
    Platform.OS === "web"
      ? ({
        loading: "lazy",
        decoding: "async",
        referrerPolicy: "no-referrer",
        sizes: `(min-width: ${MAX_WIDTH}px) ${MAX_WIDTH}px, 100vw`,
      } as any)
      : {};

  return (
    <View style={[styles.container, { width: boxWidth }]}>
      <View style={{ width: boxWidth, height: boxHeight, position: 'relative' }}>
        {!imageLoaded && !err && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.skeleton]}>
            <View style={[styles.placeholder, { width: boxWidth, height: boxHeight }]} />
          </View>
        )}

        <ExpoImage
          source={{ uri: src }}
          style={[StyleSheet.absoluteFillObject, styles.image]}
          contentFit="contain"
          transition={200}
          cachePolicy="disk-memory"
          priority={Platform.OS === 'web' ? 'low' : 'normal'}
          recyclingKey={src}
          onLoad={() => { setImageLoaded(true); }}
          onError={() => { setErr(true); }}
          {...webAttrs}
        />

        {err && (
          <View style={[StyleSheet.absoluteFillObject, styles.errorContainer]}>
            <Text style={styles.errorText}>📷</Text>
            <Text style={styles.errorMessage}>Не удалось загрузить</Text>
          </View>
        )}
      </View>
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
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  placeholder: {
    backgroundColor: '#e5e5e5',
    borderRadius: 8,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  errorText: { fontSize: 32, marginBottom: 8 },
  errorMessage: { fontSize: 14, color: "#6c757d", textAlign: "center" },
});
