import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  StyleSheet,
  Image as RNImage,
} from "react-native";
import { CustomRendererProps } from "react-native-render-html";
import { Image as ExpoImage } from "expo-image";

interface CustomImageRendererProps extends CustomRendererProps {
  contentWidth: number;
}

const MAX_WIDTH = 800;
const MAX_IMAGE_HEIGHT = 480;
const H_PADDING = 16;

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

  if (u.startsWith("//")) {
    const pageProto = typeof window !== "undefined" ? window.location.protocol : "https:";
    u = `${pageProto}${u}`;
  }

  try {
    const parsed = new URL(u, typeof window !== "undefined" ? window.location.href : "http://localhost");
    const host = parsed.hostname;

    if (!isPrivateHost(host)) {
      if (parsed.protocol === "http:") {
        parsed.protocol = "https:";
        u = parsed.toString();
      }
    } else {
      u = parsed.toString();
    }
  } catch {}

  return u;
};

/* ───────── component ───────── */
const CustomImageRenderer = ({ tnode, contentWidth }: CustomImageRendererProps) => {
  const raw = pickSrc(tnode);
  if (!raw) return null;

  const src = useMemo(() => normalizeUrl(raw), [raw]);

  const attW = tnode.attributes?.width ? Number(tnode.attributes.width) : undefined;
  const attH = tnode.attributes?.height ? Number(tnode.attributes.height) : undefined;
  const attrAR = attW && attH && attH > 0 ? attW / attH : null;

  const { width: winW } = useWindowDimensions();
  const maxFrameWidth = useMemo(
    () => Math.min(contentWidth || winW || MAX_WIDTH, MAX_WIDTH, (winW || MAX_WIDTH) - H_PADDING * 2),
    [contentWidth, winW]
  );

  const [ar, setAr] = useState<number | null>(attrAR ?? null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

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
      img.onload = () => {
        if (!mounted) return;
        if (img.naturalWidth && img.naturalHeight) setAr(img.naturalWidth / img.naturalHeight);
        setLoading(false);
      };
      img.onerror = () => {
        if (!mounted) return;
        setAr(null);
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

  const { boxWidth, boxHeight } = useMemo(() => {
    const heightIfFullWidth = maxFrameWidth / aspect;
    if (heightIfFullWidth > MAX_IMAGE_HEIGHT) {
      return { boxWidth: MAX_IMAGE_HEIGHT * aspect, boxHeight: MAX_IMAGE_HEIGHT };
    }
    return { boxWidth: maxFrameWidth, boxHeight: heightIfFullWidth };
  }, [maxFrameWidth, aspect]);

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
      <View style={{ width: boxWidth, height: boxHeight }}>
        {!imageLoaded && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.skeleton]}>
            <ActivityIndicator size="small" />
          </View>
        )}

        <ExpoImage
          source={{ uri: src }}
          style={[StyleSheet.absoluteFillObject, styles.image]}
          contentFit="contain"
          transition={200}
          cachePolicy="disk-memory"
          priority="low"
          recyclingKey={src}
          onLoad={() => setImageLoaded(true)}
          onError={() => setErr(true)}
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

export default CustomImageRenderer;

/* ───────── styles ───────── */
const styles = StyleSheet.create({
  container: {
    marginVertical: 24,
    alignItems: "center",
    paddingHorizontal: H_PADDING,
  },
  image: {
    borderRadius: 12,
    ...(Platform.OS === "web"
      ? ({ transition: "opacity 0.2s ease-in-out" } as any)
      : null),
  },
  skeleton: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  errorText: { fontSize: 32, marginBottom: 8 },
  errorMessage: { fontSize: 14, color: "#6c757d", textAlign: "center" },
});
