// components/travel/StableContent.tsx
import React, { memo, Suspense, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Linking, Platform, Text, Pressable } from "react-native";
import type { TDefaultRendererProps } from "react-native-render-html";

const LazyRenderHTML = React.lazy(() =>
  import("react-native-render-html").then((m: any) => ({ default: m.default }))
);
const LazyInstagram = React.lazy(() =>
  import("@/components/iframe/InstagramEmbed").then((m: any) => ({ default: m.default }))
);
import CustomImageRenderer from "@/components/CustomImageRenderer";

interface StableContentProps {
  html: string;
  contentWidth: number;
}

type IframeModelType = typeof import("@native-html/iframe-plugin")["iframeModel"];

const hasIframe = (html: string) => /<iframe[\s/>]/i.test(html);
const isYouTube = (src: string) => /youtube\.com|youtu\.be/i.test(src);
const isInstagram = (src: string) => /instagram\.com/i.test(src);

const extractFirstImgSrc = (html: string): string | null => {
  const m = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i);
  return m?.[1] ?? null;
};

const normalizeImgTags = (html: string): string =>
  html.replace(/<img\b[^>]*?>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? "";
    let w = tag.match(/\bwidth="(\d+)"/i)?.[1];
    let h = tag.match(/\bheight="(\d+)"/i)?.[1];
    if (!w || !h) {
      const wh = src.match(/[-_](\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i);
      if (wh) {
        w = w || wh[1];
        h = h || wh[2];
      }
    }
    const styleMatch = tag.match(/\bstyle="([^"]*)"/i);
    const style = styleMatch?.[1] ?? "";
    const ensured = ["display:block", "height:auto", "margin:0 auto"].reduce(
      (acc, rule) => (acc.includes(rule) ? acc : acc ? `${acc};${rule}` : rule),
      style
    );
    let out = tag.replace(styleMatch ? styleMatch[0] : "", "").replace(/>$/, ` style="${ensured}">`);
    out = out.replace(/\bwidth="[^"]*"/i, "").replace(/\bheight="[^"]*"/i, "");
    if (w && h) out = out.replace(/>$/, ` width="${w}" height="${h}">`);
    out = out.replace(/\bdecoding="[^"]*"/i, "").replace(/\bfetchpriority="[^"]*"/i, "");
    out = out.replace(/>$/, ` decoding="async" fetchpriority="low">`);
    return out;
  });

const replaceYouTubeIframes = (html: string): string =>
  html.replace(/<iframe\b[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src: string) => {
    if (!isYouTube(src)) return full;
    const id =
      src.match(/[?&]v=([a-z0-9_-]{6,})/i)?.[1] ||
      src.match(/youtu\.be\/([a-z0-9_-]{6,})/i)?.[1];
    if (!id) return full;
    return `
<div class="yt-lite" data-yt="${id}"
     style="position:relative;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;margin:16px 0">
  <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"
       alt="YouTube preview" loading="lazy" decoding="async"
       style="width:100%;height:100%;object-fit:cover;display:block"/>
  <button aria-label="Смотреть видео"
    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer">
    <span style="width:68px;height:48px;background:rgba(0,0,0,.6);clip-path:polygon(20% 10%,20% 90%,85% 50%);"></span>
  </button>
</div>`;
  });

const prepareHtml = (html: string) => replaceYouTubeIframes(normalizeImgTags(html));

const StableContent: React.FC<StableContentProps> = memo(({ html, contentWidth }) => {
  const [iframeModel, setIframeModel] = useState<IframeModelType | null>(null);
  const prepared = useMemo(() => prepareHtml(html), [html]);

  // базовая типографика — ПИКСЕЛИ, не коэффициент!
  const BASE_FONT_SIZE = Platform.select({ ios: 16, android: 16, default: 17 })!;
  const BASE_LINE_HEIGHT = Math.round(BASE_FONT_SIZE * 1.55); // ~1.55em

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const first = extractFirstImgSrc(prepared);
    if (!first) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = first;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, [prepared]);

  useEffect(() => {
    let cancelled = false;
    if (hasIframe(prepared)) {
      import("@native-html/iframe-plugin")
        .then((m) => !cancelled && setIframeModel(m.iframeModel))
        .catch(() => setIframeModel(null));
    } else setIframeModel(null);
    return () => {
      cancelled = true;
    };
  }, [prepared]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onClick = (e: any) => {
      const root = (e.target as HTMLElement)?.closest?.(".yt-lite") as HTMLElement | null;
      if (!root) return;
      const vid = root.getAttribute("data-yt");
      if (!vid) return;
      const iframe = document.createElement("iframe");
      iframe.width = "560";
      iframe.height = "315";
      iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`;
      iframe.title = "YouTube video";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      // @ts-ignore
      iframe.allowFullscreen = true;
      Object.assign(iframe.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        border: "0",
      });
      root.innerHTML = "";
      root.appendChild(iframe);
    };
    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick as any);
  }, []);

  const renderers = useMemo(() => {
    return {
      img: (props: TDefaultRendererProps) => {
        try {
          // @ts-ignore
          return <CustomImageRenderer {...props} contentWidth={contentWidth} />;
        } catch {
          const { TDefaultRenderer, ...rest } = props;
          return <TDefaultRenderer {...rest} />;
        }
      },
      iframe: (props: TDefaultRendererProps) => {
        const attrs = (props.tnode?.attributes || {}) as any;
        const src: string = attrs.src || "";

        if (!src) {
          const { TDefaultRenderer, ...rest } = props;
          return <TDefaultRenderer {...rest} />;
        }

        if (isInstagram(src)) {
          const url = src.replace("/embed/captioned/", "/").split("?")[0];
          return (
            <View style={{ marginVertical: 14, alignItems: "center" }}>
              <Suspense fallback={<Text>Instagram…</Text>}>
                <LazyInstagram url={url} />
              </Suspense>
            </View>
          );
        }

        if (isYouTube(src)) {
          if (Platform.OS !== "web") {
            const open = () => Linking.openURL(src).catch(() => {});
            return (
              <Pressable onPress={open} style={styles.ytStub}>
                <Text style={styles.ytStubText}>Смотреть на YouTube</Text>
              </Pressable>
            );
          }
          const { TDefaultRenderer, ...rest } = props;
          return <TDefaultRenderer {...rest} />;
        }

        const { TDefaultRenderer, ...rest } = props;
        return <TDefaultRenderer {...rest} />;
      },
    };
  }, [contentWidth]);

  // ВНИМАНИЕ: lineHeight задаём через baseStyle (px). В tagsStyles не переопределяем.
  const baseStyle = useMemo(
    () => ({
      color: "#1a1a1a",
      fontSize: BASE_FONT_SIZE,
      lineHeight: BASE_LINE_HEIGHT,
    }),
    [BASE_FONT_SIZE, BASE_LINE_HEIGHT]
  );

  const tagsStyles = useMemo(
    () => ({
      p: { marginTop: 10, marginBottom: 10 },
      strong: { fontWeight: "600" },
      em: { fontStyle: "italic" },

      // заголовки — согласованный lineHeight
      h1: { fontSize: BASE_FONT_SIZE + 12, lineHeight: Math.round((BASE_FONT_SIZE + 12) * 1.3), fontWeight: "700", marginVertical: 12 },
      h2: { fontSize: BASE_FONT_SIZE + 8,  lineHeight: Math.round((BASE_FONT_SIZE + 8)  * 1.34), fontWeight: "700", marginVertical: 12 },
      h3: { fontSize: BASE_FONT_SIZE + 4,  lineHeight: Math.round((BASE_FONT_SIZE + 4)  * 1.38), fontWeight: "700", marginVertical: 10 },

      ul: { marginVertical: 8, paddingLeft: 20 },
      li: { marginVertical: 4 },

      figure: {
        margin: 0,
        padding: 0,
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        flexDirection: "column",
      },
      figcaption: {
        textAlign: "center",
        fontSize: BASE_FONT_SIZE - 2,
        opacity: 0.75,
        marginTop: 6,      // НЕ отрицательное значение — не накладывается на фото
        lineHeight: Math.round((BASE_FONT_SIZE - 2) * 1.4),
      },

      img: {
        maxWidth: "100%",
        height: "auto",
        borderRadius: 12,
        marginVertical: 12,
        display: "block",
        alignSelf: "center",
        boxShadow: Platform.OS === "web" ? "0 2px 8px rgba(0,0,0,0.05)" : undefined,
      },

      iframe: {
        width: "100%",
        height: Math.round(contentWidth * 0.5625),
        display: "block",
        borderRadius: 12,
        overflow: "hidden",
        marginVertical: 14,
      },
    }),
    [BASE_FONT_SIZE, BASE_LINE_HEIGHT, contentWidth]
  );

  const customHTMLElementModels = useMemo(
    () => (iframeModel ? { iframe: iframeModel } : undefined),
    [iframeModel]
  );

  const handleLinkPress = (_: any, href?: string) => {
    if (!href) return;
    if (/^https?:\/\//i.test(href)) {
      Linking.openURL(href).catch(() => {});
    } else if (href.startsWith("/") && Platform.OS === "web") {
      window.location.assign(href);
    }
  };

  return (
    <View style={styles.htmlWrapper}>
      <Suspense fallback={null}>
        <LazyRenderHTML
          key={prepared.length}
          source={{ html: prepared }}
          contentWidth={contentWidth}
          {...(customHTMLElementModels ? { customHTMLElementModels } : {})}
          renderers={renderers as any}
          defaultTextProps={{ selectable: Platform.OS !== "web" }}
          onLinkPress={handleLinkPress}
          baseStyle={baseStyle as any}
          tagsStyles={tagsStyles as any}
          ignoredDomTags={["script", "style"]}
        />
      </Suspense>
    </View>
  );
});

export default StableContent;

const styles = StyleSheet.create({
  htmlWrapper: {
    flexDirection: "column",
    width: "100%",
    alignSelf: "center",
  },
  ytStub: {
    marginVertical: 10,
    aspectRatio: 16 / 9,
    backgroundColor: "#eee",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ytStubText: {
    color: "#111",
    fontSize: 14,
  },
});
