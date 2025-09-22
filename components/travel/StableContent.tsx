import React, { memo, Suspense, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Linking, Platform, Text } from "react-native";
import type { TDefaultRendererProps } from "react-native-render-html";

// ⚡️ Ленивая подгрузка оставляем только для действительно тяжёлых вещей
const LazyRenderHTML = React.lazy(() =>
  import("react-native-render-html").then((m: any) => ({ default: m.default }))
);
const LazyInstagram = React.lazy(() =>
  import("@/components/iframe/InstagramEmbed").then((m: any) => ({ default: m.default }))
);

// ВАЖНО: изображение — синхронно, чтобы не терять <img>
import CustomImageRenderer from "@/components/CustomImageRenderer";

interface StableContentProps {
    html: string;
    contentWidth: number;
}

type IframeModelType = typeof import("@native-html/iframe-plugin")["iframeModel"];

const hasIframe = (html: string) => /<iframe[\s/>]/i.test(html);
const isYouTube = (src: string) => /youtube\.com|youtu\.be/i.test(src);
const isInstagram = (src: string) => /instagram\.com/i.test(src);

const StableContent: React.FC<StableContentProps> = memo(({ html, contentWidth }) => {
    const [iframeModel, setIframeModel] = useState<IframeModelType | null>(null);

    // Загружаем модель iframe только если она реально нужна
    useEffect(() => {
        let cancelled = false;
        if (hasIframe(html)) {
            import("@native-html/iframe-plugin")
              .then((m) => { if (!cancelled) setIframeModel(m.iframeModel); })
              .catch(() => setIframeModel(null));
        } else {
            setIframeModel(null);
        }
        return () => { cancelled = true; };
    }, [html]);

    // Рендереры
    const renderers = useMemo(() => {
        return {
            // IMG — синхронный, максимально надёжный рендер
            img: (props: TDefaultRendererProps) => {
                try {
                    // @ts-ignore tnode есть в пропсах TDefaultRendererProps
                    return <CustomImageRenderer {...props} contentWidth={contentWidth} />;
                } catch {
                    // Fallback: если что-то пошло не так, пусть отрисует дефолт
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
                    // Лёгкая заглушка — настоящий YouTube рендерим через LazyYouTube в другом компоненте
                    return (
                      <View
                        style={{
                            marginVertical: 10,
                            aspectRatio: 16 / 9,
                            backgroundColor: "#eee",
                            borderRadius: 8,
                        }}
                      />
                    );
                }

                const { TDefaultRenderer, ...rest } = props;
                return <TDefaultRenderer {...rest} />;
            },
        };
    }, [contentWidth]);

    // Стили для тегов
    const tagsStyles = useMemo(
      () => ({
          p: { marginTop: 15, marginBottom: 0 },
          iframe: {
              width: "100%",
              height: Math.round(contentWidth * 0.5625),
          },
          img: {
              maxWidth: "100%",
              height: "auto",
              display: "block",
          },
      }),
      [contentWidth]
    );

    // Модели элементов — только когда iframeModel загружен
    const customHTMLElementModels = useMemo(
      () => (iframeModel ? { iframe: iframeModel } : undefined),
      [iframeModel]
    );

    const handleLinkPress = (_: any, href?: string) => {
        if (!href) return;
        // защита от javascript: и пр.
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
                source={{ html }}
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
});
