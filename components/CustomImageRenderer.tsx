import React, { useEffect, useMemo, useState } from "react";
import { View, Platform, useWindowDimensions, ActivityIndicator, Text, StyleSheet } from "react-native";
import { CustomRendererProps } from "react-native-render-html";
import { Image as ExpoImage } from "expo-image";

interface CustomImageRendererProps extends CustomRendererProps {
  contentWidth: number;
}

const MIN_HEIGHT = 400;

const pickSrc = (tnode: any) => {
  const a = tnode?.attributes || {};
  const raw = a.src || a["data-src"] || "";
  if (!raw && a.srcset) {
    const first = String(a.srcset).split(",")[0]?.trim().split(" ")[0];
    return first || "";
  }
  return raw;
};

const CustomImageRenderer = ({ tnode, contentWidth }: CustomImageRendererProps) => {
  const rawSrc = pickSrc(tnode);
  const alt = tnode.attributes?.alt || "";

  if (!rawSrc) return null;

  // Оптимизация протокола и добавление параметров сжатия для CDN
  const src = useMemo(() => {
    let processedSrc = rawSrc;

    // Принудительно используем HTTPS в production
    if (typeof window !== "undefined" && window.location?.protocol === "https:") {
      processedSrc = processedSrc.replace(/^http:\/\//i, "https://");
    }

    // Добавляем параметры оптимизации для известных CDN
    if (processedSrc.includes('upload.wikimedia.org') ||
      processedSrc.includes('unsplash.com') ||
      processedSrc.includes('cloudinary.com')) {
      if (!processedSrc.includes('?') && !processedSrc.includes('width=')) {
        processedSrc += `?auto=format,compress&q=80`;
      }
    }

    return processedSrc;
  }, [rawSrc]);

  const attW = tnode.attributes?.width ? Number(tnode.attributes.width) : undefined;
  const attH = tnode.attributes?.height ? Number(tnode.attributes.height) : undefined;
  const attrAR = attW && attH && attH > 0 ? attW / attH : null;

  const { height: vh } = useWindowDimensions();
  const [ar, setAr] = useState<number | null>(attrAR ?? null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Адаптивная ширина с максимальным ограничением
  const imgW = useMemo(() => {
    const maxWidth = Math.min(contentWidth, 800); // Ограничиваем максимальную ширину
    return Math.max(260, Math.round(maxWidth));
  }, [contentWidth]);

  useEffect(() => {
    let mounted = true;
    setErr(false);
    setLoading(true);
    setImageLoaded(false);

    if (Platform.OS === "web") {
      // Быстрая загрузка для web с progressive enhancement
      setLoading(false);
      if (!ar) setAr(null);
      return () => { mounted = false; };
    }

    if (attrAR) {
      setAr(attrAR);
      setLoading(false);
      return () => { mounted = false; };
    }

    // Определение размеров для native
    // @ts-ignore
    const { Image } = require("react-native");
    Image.getSize(
      src,
      (w: number, h: number) => {
        if (!mounted) return;
        if (h > 0) setAr(w / h);
        setLoading(false);
      },
      () => { if (mounted) { setAr(null); setLoading(false); } }
    );

    return () => { mounted = false; };
  }, [src, attrAR]);

  const imgH = useMemo(() => {
    if (ar && ar > 0) {
      const h = Math.max(MIN_HEIGHT, Math.round(imgW / ar));
      return ar < 0.75 ? Math.min(h, Math.round(vh * 0.75)) : h; // Уменьшил до 75% для мобильных
    }
    return MIN_HEIGHT;
  }, [ar, imgW, vh]);

  // Web-оптимизации
  const webAttrs = Platform.OS === "web" ? {
    loading: "lazy",
    decoding: "async",
    fetchpriority: "low",
    referrerpolicy: "no-referrer",
  } as any : {};

  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        {/* Градиентная рамка с современным дизайном */}
        <View style={styles.gradientBorder}>
          <View style={styles.imageContainer}>

            {/* Skeleton loader с анимацией */}
            {loading && !imageLoaded && (
              <View style={[styles.skeleton, { width: imgW, height: imgH }]}>
                <ActivityIndicator size="small" color="#e0e0e0" />
              </View>
            )}

            {/* Основное изображение */}
            <ExpoImage
              source={{ uri: src }}
              style={[
                styles.image,
                {
                  width: imgW,
                  height: imgH,
                  opacity: imageLoaded ? 1 : 0
                }
              ]}
              contentFit="cover"
              transition={200}
              cachePolicy="disk-memory"
              priority="low"
              accessibilityLabel={alt}
              accessibilityIgnoresInvertColors
              onLoad={() => {
                setImageLoaded(true);
                setLoading(false);
              }}
              onError={() => setErr(true)}
              {...webAttrs}
            />

            {/* Состояние ошибки */}
            {err && (
              <View style={[styles.errorContainer, { width: imgW, height: imgH }]}>
                <Text style={styles.errorText}>📷</Text>
                <Text style={styles.errorMessage}>Изображение не загружено</Text>
              </View>
            )}
          </View>
        </View>

        {/* Подпись с улучшенной типографикой */}
        {alt && alt.toLowerCase() !== "image" && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption} numberOfLines={3}>
              {alt}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default CustomImageRenderer;

/* ───────────────── СОВРЕМЕННЫЕ СТИЛИ ───────────────── */
const styles = StyleSheet.create({
  container: {
    marginVertical: 24,
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    alignItems: "center",
  },
  gradientBorder: {
    borderRadius: 16,
    padding: 3,
    background: Platform.OS === "web" ?
      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" :
      "#667eea",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  imageContainer: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#f8f9fa",
    position: "relative",
  },
  image: {
    borderRadius: 12,
    transition: "opacity 0.3s ease-in-out",
  },
  skeleton: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    position: "absolute",
    zIndex: 1,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 20,
  },
  errorText: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
  },
  captionContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    maxWidth: 800,
  },
  caption: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: "#495057",
    fontStyle: "italic",
    letterSpacing: 0.1,
  },
});