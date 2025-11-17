// components/travel/StableContent.tsx
import React, { memo, Suspense, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Linking, Platform, Text, Pressable } from "react-native";
import type { TDefaultRendererProps } from "react-native-render-html";
import { sanitizeRichText } from '@/src/utils/sanitizeRichText';

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

const stripDangerousTags = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

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
  <div role="button" tabindex="0" aria-label="Смотреть видео"
    style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer">
    <span style="width:68px;height:48px;background:rgba(0,0,0,.6);clip-path:polygon(20% 10%,20% 90%,85% 50%);"></span>
  </div>
</div>`;
  });

const prepareHtml = (html: string) => {
  const safe = sanitizeRichText(html);
  return replaceYouTubeIframes(normalizeImgTags(stripDangerousTags(safe)));
};

const WEB_RICH_TEXT_CLASS = "travel-rich-text";
const WEB_RICH_TEXT_STYLES_ID = "travel-rich-text-styles";
const WEB_RICH_TEXT_STYLES = `
.${WEB_RICH_TEXT_CLASS} {
  font-family: "Georgia", "Times New Roman", serif;
  font-size: 17px;
  line-height: 1.7;
  color: #1a1a1a;
  text-align: justify;
  hyphens: auto;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 8px 0 24px;
}
.${WEB_RICH_TEXT_CLASS} p {
  margin: 0 0 1.25em;
}
.${WEB_RICH_TEXT_CLASS} h1,
.${WEB_RICH_TEXT_CLASS} h2,
.${WEB_RICH_TEXT_CLASS} h3 {
  color: #111a2b;
  line-height: 1.3;
  margin: 1.6em 0 0.7em;
}
.${WEB_RICH_TEXT_CLASS} h1 { font-size: clamp(1.8rem, 2vw, 2.6rem); }
.${WEB_RICH_TEXT_CLASS} h2 { font-size: clamp(1.5rem, 1.6vw, 2.1rem); }
.${WEB_RICH_TEXT_CLASS} h3 { font-size: clamp(1.25rem, 1.2vw, 1.6rem); }
.${WEB_RICH_TEXT_CLASS} ul,
.${WEB_RICH_TEXT_CLASS} ol {
  margin: 0 0 1.3em 1.6em;
  padding: 0;
}
.${WEB_RICH_TEXT_CLASS} li { margin-bottom: 0.4em; }
.${WEB_RICH_TEXT_CLASS} img {
  display: block;
  width: min(640px, 100%);
  max-height: 70vh;
  object-fit: cover;
  border-radius: 22px;
  margin: 24px auto;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
  border: 8px solid rgba(255, 255, 255, 0.12);
  background: #fafafa;
}
.${WEB_RICH_TEXT_CLASS} figure {
  margin: 30px auto;
  width: min(660px, 100%);
  text-align: center;
}
.${WEB_RICH_TEXT_CLASS} figure img {
  margin-bottom: 12px;
}
.${WEB_RICH_TEXT_CLASS} .image-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin: 28px 0;
}
.${WEB_RICH_TEXT_CLASS} .image-strip img {
  width: 100%;
  margin: 0;
  box-shadow: 0 15px 30px rgba(15, 23, 42, 0.15);
}
.${WEB_RICH_TEXT_CLASS} figure {
  margin: 0;
}
.${WEB_RICH_TEXT_CLASS} figcaption {
  text-align: center;
  font-size: 0.9rem;
  color: rgba(15, 23, 42, 0.7);
  margin-top: 6px;
}
.${WEB_RICH_TEXT_CLASS} iframe,
.${WEB_RICH_TEXT_CLASS} .yt-lite {
  display: block;
  max-width: 100%;
  border-radius: 18px;
  overflow: hidden;
  margin: 24px 0;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}
.${WEB_RICH_TEXT_CLASS}::after {
  content: "";
  display: block;
  clear: both;
}
@media (max-width: 900px) {
  .${WEB_RICH_TEXT_CLASS} {
    text-align: left;
    hyphens: unset;
  }
  .${WEB_RICH_TEXT_CLASS} img {
    width: min(520px, 100%);
    border-width: 6px;
    margin: 20px auto;
  }
}
`;

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
      // ✅ УЛУЧШЕНИЕ: Улучшенная типографика для читаемости
      p: { 
        marginTop: 12, 
        marginBottom: 12, 
        lineHeight: Math.round(BASE_FONT_SIZE * 1.6), // Межстрочный интервал 1.6
      },
      strong: { fontWeight: "700" }, // ✅ Более жирный для выделения
      em: { fontStyle: "italic", color: "#4a5568" }, // ✅ Немного другой цвет для курсива

      // ✅ УЛУЧШЕНИЕ: Заголовки с улучшенной иерархией
      h1: { 
        fontSize: BASE_FONT_SIZE + 12, // ~28-29px
        lineHeight: Math.round((BASE_FONT_SIZE + 12) * 1.3), 
        fontWeight: "700", 
        marginTop: 24,
        marginBottom: 16,
        color: "#1a202c", // ✅ Более темный цвет
      },
      h2: { 
        fontSize: BASE_FONT_SIZE + 8, // ~24-25px
        lineHeight: Math.round((BASE_FONT_SIZE + 8) * 1.34), 
        fontWeight: "700", 
        marginTop: 20,
        marginBottom: 12,
        color: "#1a202c",
      },
      h3: { 
        fontSize: BASE_FONT_SIZE + 4, // ~20-21px
        lineHeight: Math.round((BASE_FONT_SIZE + 4) * 1.38), 
        fontWeight: "700", 
        marginTop: 18,
        marginBottom: 10,
        color: "#2d3748",
      },

      // ✅ УЛУЧШЕНИЕ: Улучшенные списки
      ul: { 
        marginVertical: 12, 
        paddingLeft: 24, // ✅ Увеличенный отступ
      },
      ol: {
        marginVertical: 12,
        paddingLeft: 24,
      },
      li: { 
        marginVertical: 6, // ✅ Увеличенный отступ между элементами
        lineHeight: Math.round(BASE_FONT_SIZE * 1.6),
      },

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

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (document.getElementById(WEB_RICH_TEXT_STYLES_ID)) return;
    const style = document.createElement("style");
    style.id = WEB_RICH_TEXT_STYLES_ID;
    style.textContent = WEB_RICH_TEXT_STYLES;
    document.head.appendChild(style);
  }, []);

  if (Platform.OS === "web") {
    return (
      <div
        className={WEB_RICH_TEXT_CLASS}
        dangerouslySetInnerHTML={{ __html: prepared }}
      />
    );
  }

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
