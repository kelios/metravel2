import React, { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Linking, Platform, Text, Pressable } from "react-native";
import type { TDefaultRendererProps } from "react-native-render-html";

// ⚡️ Ленивая подгрузка — только для тяжёлых штук
const LazyRenderHTML = React.lazy(() =>
  import("react-native-render-html").then((m: any) => ({ default: m.default }))
);
const LazyInstagram = React.lazy(() =>
  import("@/components/iframe/InstagramEmbed").then((m: any) => ({ default: m.default }))
);

// IMG — синхронно, чтобы не «терять» теги <img>
import CustomImageRenderer from "@/components/CustomImageRenderer";

interface StableContentProps {
    html: string;
    contentWidth: number;
}

type IframeModelType = typeof import("@native-html/iframe-plugin")["iframeModel"];

const hasIframe = (html: string) => /<iframe[\s/>]/i.test(html);
const isYouTube = (src: string) => /youtube\.com|youtu\.be/i.test(src);
const isInstagram = (src: string) => /instagram\.com/i.test(src);

// вытаскиваем первую картинку для LCP/preload (на web)
const extractFirstImgSrc = (html: string): string | null => {
    const m = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i);
    return m?.[1] ?? null;
};

// немного нормализуем <img>: width/height/aspect (уменьшаем CLS)
const normalizeImgTags = (html: string): string =>
  html.replace(/<img\b[^>]*?>/gi, (tag) => {
      const src = tag.match(/\bsrc="([^"]+)"/i)?.[1] ?? "";
      // width/height
      let w = tag.match(/\bwidth="(\d+)"/i)?.[1];
      let h = tag.match(/\bheight="(\d+)"/i)?.[1];
      if (!w || !h) {
          const wh = src.match(/[-_](\d{2,5})x(\d{2,5})\.(?:jpe?g|png|webp|avif)(?:\?|$)/i);
          if (wh) {
              w = w || wh[1];
              h = h || wh[2];
          }
      }
      // style: height:auto; display:block
      const styleMatch = tag.match(/\bstyle="([^"]*)"/i);
      const style = styleMatch?.[1] ?? "";
      const ensured = ["display:block", "height:auto"].reduce((acc, rule) => {
          return acc.includes(rule) ? acc : (acc ? `${acc};${rule}` : rule);
      }, style);
      let out = tag.replace(styleMatch ? styleMatch[0] : "", "").replace(/>$/, ` style="${ensured}">`);
      // проставим размеры, если вычислились
      out = out.replace(/\bwidth="[^"]*"/i, "").replace(/\bheight="[^"]*"/i, "");
      if (w && h) out = out.replace(/>$/, ` width="${w}" height="${h}">`);
      // decoding / fetchpriority для web-рендера (на RN-web проставится в DOM)
      out = out.replace(/\bdecoding="[^"]*"/i, "").replace(/\bfetchpriority="[^"]*"/i, "");
      out = out.replace(/>$/, ` decoding="async" fetchpriority="low">`);
      return out;
  });

// заменяем youtube iframe на лёгкую «шторку» (iframe по клику)
const replaceYouTubeIframes = (html: string): string =>
  html.replace(/<iframe\b[^>]*src="([^"]+)"[^>]*><\/iframe>/gi, (full, src: string) => {
      if (!isYouTube(src)) return full;
      const id =
        src.match(/[?&]v=([a-z0-9_-]{6,})/i)?.[1] ||
        src.match(/youtu\.be\/([a-z0-9_-]{6,})/i)?.[1];
      if (!id) return full;
      // aspect-ratio 16:9, фиксированная высота — без скачков
      return `
<div class="yt-lite" data-yt="${id}" style="position:relative;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden">
  <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="YouTube preview" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block"/>
  <button aria-label="Смотреть видео" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer">
    <span style="width:68px;height:48px;background:rgba(0,0,0,.6);clip-path:polygon(20% 10%, 20% 90%, 85% 50%);"></span>
  </button>
</div>`;
  });

// готовим HTML: нормализуем img + заменяем youtube-iframe
const prepareHtml = (html: string) => replaceYouTubeIframes(normalizeImgTags(html));

const StableContent: React.FC<StableContentProps> = memo(({ html, contentWidth }) => {
    const [iframeModel, setIframeModel] = useState<IframeModelType | null>(null);
    const prepared = useMemo(() => prepareHtml(html), [html]);

    // Предзагрузка первой картинки на web (ускоряем LCP)
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
        return () => {
            document.head.removeChild(link);
        };
    }, [prepared]);

    // Загружаем модель iframe только если реально нужна
    useEffect(() => {
        let cancelled = false;
        if (hasIframe(prepared)) {
            import("@native-html/iframe-plugin")
              .then((m) => {
                  if (!cancelled) setIframeModel(m.iframeModel);
              })
              .catch(() => setIframeModel(null));
        } else {
            setIframeModel(null);
        }
        return () => {
            cancelled = true;
        };
    }, [prepared]);

    // Делегат клика для yt-lite (создаём iframe только по клику) — web only
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

    // Рендереры
    const renderers = useMemo(() => {
        return {
            // IMG — синхронный, с учётом ширины контента
            img: (props: TDefaultRendererProps) => {
                try {
                    // @ts-ignore tnode есть в пропсах TDefaultRendererProps
                    return <CustomImageRenderer {...props} contentWidth={contentWidth} />;
                } catch {
                    const { TDefaultRenderer, ...rest } = props;
                    return <TDefaultRenderer {...rest} />;
                }
            },

            // IFRAME — выборочно подменяем
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
                      <View style={{ marginVertical: 10 }}>
                          <Suspense fallback={<Text>Instagram…</Text>}>
                              <LazyInstagram url={url} />
                          </Suspense>
                      </View>
                    );
                }

                if (isYouTube(src)) {
                    // На native — просто кликабельная заглушка, открываем в приложении YouTube/браузере
                    if (Platform.OS !== "web") {
                        const open = () => Linking.openURL(src).catch(() => {});
                        return (
                          <Pressable onPress={open} style={styles.ytStub}>
                              <Text style={styles.ytStubText}>Смотреть на YouTube</Text>
                          </Pressable>
                        );
                    }
                    // На web мы уже заменили на .yt-lite в prepared HTML (см. prepareHtml)
                    const { TDefaultRenderer, ...rest } = props;
                    return <TDefaultRenderer {...rest} />;
                }

                const { TDefaultRenderer, ...rest } = props;
                return <TDefaultRenderer {...rest} />;
            },
        };
    }, [contentWidth]);

    // Стили для тегов (резервируем место под медиа → CLS↓)
    const tagsStyles = useMemo(
      () => ({
          p: { marginTop: 15, marginBottom: 0 },
          figure: { margin: 0 },
          figcaption: { textAlign: "center", fontSize: 13, opacity: 0.8, marginTop: 6 },
          iframe: {
              width: "100%",
              height: Math.round(contentWidth * 0.5625), // 16:9
              display: "block",
          },
          img: {
              maxWidth: "100%",
              height: "auto",
              display: "block",
          },
      }),
      [contentWidth]
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
            // относительные ссылки на web — нативный переход
            window.location.assign(href);
        }
    };

    return (
      <View style={styles.htmlWrapper}>
          <Suspense fallback={null}>
              <LazyRenderHTML
                key={prepared.length} // стабильная перестройка при замене контента
                source={{ html: prepared }}
                contentWidth={contentWidth}
                {...(customHTMLElementModels ? { customHTMLElementModels } : {})}
                renderers={renderers as any}
                defaultTextProps={{ selectable: Platform.OS !== "web" }}
                onLinkPress={handleLinkPress}
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
    },
    ytStub: {
        marginVertical: 10,
        aspectRatio: 16 / 9,
        backgroundColor: "#eee",
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    ytStubText: {
        color: "#111",
        fontSize: 14,
    },
});
