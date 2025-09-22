import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  Text,
  StyleSheet,
  Image as RNImage,
} from "react-native";
import { CustomRendererProps } from "react-native-render-html";
import { Image as ExpoImage } from "expo-image";

interface CustomImageRendererProps extends CustomRendererProps {
  contentWidth: number;
}

const MAX_WIDTH = 800;
const H_PADDING = 16;
const BORDER_PADDING = 8;

/* ───────── helpers ───────── */
const pickSrc = (tnode: any) => {
  const a = tnode?.attributes || {};
  const raw = a.src || a["data-src"] || "";
  if (!raw && a.srcset) {
    const first = String(a.srcset).split(",")[0]?.trim().split(/\s+/)[0];
    return first || "";
  }
  return raw;
};

const isPrivateHost = (host: string) => {
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^127\.0\.0\.1$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
};

const normalizeUrl = (url: string) => {
  let u = (url || "").trim();
  if (!u) return u;

  // protocol-relative -> inherit page protocol (предпочтём https, но не ломаем dev)
  if (u.startsWith("//")) {
    const pageProto = typeof window !== "undefined" ? window.location.protocol : "https:";
    u = `${pageProto}${u}`;
  }

  // Если это абсолютный URL — решаем, апгрейдить ли до https
  try {
    const parsed = new URL(u, typeof window !== "undefined" ? window.location.href : "http://localhost");
    const host = parsed.hostname;

    // Для локальных/приватных — оставляем как есть (иначе ERR_CONNECTION_REFUSED)
    if (!isPrivateHost(host)) {
      // Для публичных: апгрейдим http->https, если было http
      if (parsed.protocol === "http:") {
        parsed.protocol = "https:";
        u = parsed.toString();
      }
    } else {
      // приватные: ничего не трогаем
      u = parsed.toString();
    }
  } catch {
    // не смогли распарсить — оставляем исходную строку
  }

  // Лёгкая оптимизация для популярных CDN
  const low = u.toLowerCase();
  const isCdn =
    low.includes("upload.wikimedia.org") ||
    low.includes("unsplash.com") ||
    low.includes("cloudinary.com");
  if (isCdn) {
    const hasQuery = u.includes("?");
    const hasW = /(?:[?&](?:w|width)=\d+)/i.test(u);
    if (!hasQuery && !hasW) u += "?auto=format,compress&q=80";
  }

  return u;
};

/* ───────── component ───────── */
const CustomImageRenderer = ({ tnode, contentWidth }: CustomImageRendererProps) => {
  const raw = pickSrc(tnode);
  const alt = tnode.attributes?.alt || "";
  if (!raw) return null;

  const src = useMemo(() => normalizeUrl(raw), [raw]);

  const attW = tnode.attributes?.width ? Number(tnode.attributes.width) : undefined;
  const attH = tnode.attributes?.height ? Number(tnode.attributes.height) : undefined;
  const attrAR = attW && attH && attH > 0 ? attW / attH : null;

  const { width: winW } = useWindowDimensions();
  const frameWidth = useMemo(
    () => Math.min(contentWidth || winW || MAX_WIDTH, MAX_WIDTH, (winW || MAX_WIDTH) - H_PADDING * 2),
    [contentWidth, winW]
  );

  const [ar, setAr] = useState<number | null>(attrAR ?? null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Пред-замер размеров: НЕ считаем ошибкой — просто падаем на дефолтный AR
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setImageLoaded(false);
    setErr(false);

    if (attrAR) {
      setAr(attrAR);
      setLoading(false);
      return () => { mounted = false; };
    }

    if (Platform.OS === "web") {
      const img = new (window as any).Image();
      img.decoding = "async";
      (img as any).loading = "lazy";
      (img as any).fetchPriority = "low";
      (img as any).referrerPolicy = "no-referrer";
      img.onload = () => {
        if (!mounted) return;
        if (img.naturalWidth && img.naturalHeight) setAr(img.naturalWidth / img.naturalHeight);
        setLoading(false);
      };
      img.onerror = () => {
        if (!mounted) return;
        setAr(null); // fallback
        setLoading(false);
      };
      img.src = src;
      return () => { mounted = false; };
    }

    RNImage.getSize(
      src,
      (w, h) => { if (mounted) { if (h > 0) setAr(w / h); setLoading(false); } },
      () => { if (mounted) { setAr(null); setLoading(false); } }
    );

    return () => { mounted = false; };
  }, [src, attrAR]);

  const aspect = ar && ar > 0 ? ar : 16 / 9;

  const webAttrs =
    Platform.OS === "web"
      ? ({
        loading: "lazy",
        decoding: "async",
        fetchPriority: "low",
        referrerPolicy: "no-referrer",
        sizes: `(min-width: ${MAX_WIDTH}px) ${MAX_WIDTH}px, 100vw`,
      } as any)
      : {};

  return (
    <View style={styles.container}>
      <View style={[styles.lightBorder, { width: frameWidth, padding: BORDER_PADDING }]}>
        <View style={[styles.ratioBox, { width: "100%", aspectRatio: aspect }]}>
          {/* skeleton */}
          {!imageLoaded && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.skeleton]}>
              <ActivityIndicator size="small" />
            </View>
          )}

          {/* изображение */}
          <ExpoImage
            source={{ uri: src }}
            style={[StyleSheet.absoluteFillObject, styles.image]}
            contentFit="contain"          // не режем и не тянем
            transition={200}
            cachePolicy="disk-memory"
            priority="low"
            accessibilityLabel={alt}
            accessibilityIgnoresInvertColors
            recyclingKey={src}
            onLoad={() => { setImageLoaded(true); }}
            onError={() => { setErr(true); }}
            {...webAttrs}
          />

          {/* ошибка — только если реальный onError */}
          {err && (
            <View style={[StyleSheet.absoluteFillObject, styles.errorContainer]}>
              <Text style={styles.errorText}>📷</Text>
              <Text style={styles.errorMessage}>Изображение не загружено</Text>
            </View>
          )}
        </View>
      </View>

      {alt && alt.toLowerCase() !== "image" && (
        <View style={[styles.captionContainer, { width: frameWidth }]}>
          <Text style={styles.caption} numberOfLines={3}>{alt}</Text>
        </View>
      )}
    </View>
  );
};

export default CustomImageRenderer;

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container: {
    marginVertical: 24,
    alignItems: "center",
    paddingHorizontal: H_PADDING,
  },
  lightBorder: {
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e9ecef",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  ratioBox: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f4f6f8",
    position: "relative",
  },
  image: {
    borderRadius: 8,
    ...(Platform.OS === "web" ? ({ transition: "opacity 0.2s ease-in-out" } as any) : null),
  },
  skeleton: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f6f8",
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f6f8",
  },
  errorText: { fontSize: 32, marginBottom: 8 },
  errorMessage: { fontSize: 14, color: "#6c757d", textAlign: "center" },
  captionContainer: { marginTop: 12 },
  caption: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#495057",
    fontStyle: "italic",
  },
});
