import React, { memo, Suspense, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Linking, Platform, Text } from "react-native";
import type { TDefaultRendererProps } from "react-native-render-html";

// ⚡️ Ленивая подгрузка тяжёлых компонентов
const LazyRenderHTML = React.lazy(() =>
    import("react-native-render-html").then((m: any) => ({ default: m.default }))
);
const LazyInstagram = React.lazy(() =>
    import("@/components/iframe/InstagramEmbed").then((m: any) => ({ default: m.default }))
);
const LazyCustomImageRenderer = React.lazy(() =>
    import("@/components/CustomImageRenderer").then((m: any) => ({ default: m.default }))
);

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

    // Загружаем модель iframe только если нужен iframe
    useEffect(() => {
        let cancelled = false;
        if (hasIframe(html)) {
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
    }, [html]);

    // Рендереры элементов
    const renderers = useMemo(() => {
        return {
            img: (props: any) => (
                <Suspense fallback={null}>
                    <LazyCustomImageRenderer {...props} contentWidth={contentWidth} />
                </Suspense>
            ),
            iframe: (props: TDefaultRendererProps) => {
                let { src = "" } = props.tnode.attributes as any;
                if (!src) {
                    const { TDefaultRenderer, ...rest } = props;
                    return <TDefaultRenderer {...rest} />;
                }

                if (isInstagram(src)) {
                    // нормализуем урл
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
                    // лёгкий плейсхолдер — сам iframe грузит страница (YouTube мы показываем через LazyYouTube в другой секции)
                    return <View style={{ marginVertical: 10, aspectRatio: 16 / 9, backgroundColor: "#eee", borderRadius: 8 }} />;
                }

                // дефолтный iframe (карты/прочее) — отрисовка через TDefaultRenderer
                const { TDefaultRenderer, ...rest } = props;
                return <TDefaultRenderer {...rest} />;
            },
        };
    }, [contentWidth]);

    // Стили для тегов — мемо, чтобы не пересоздавать объект
    const tagsStyles = useMemo(
        () => ({
            p: { marginTop: 15, marginBottom: 0 },
            iframe: {
                width: "100%",
                height: Math.round(contentWidth * 0.5625),
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
        // простая защита от javascript: и прочего
        if (/^https?:\/\//i.test(href) || href.startsWith("/")) {
            Linking.openURL(href).catch(() => {});
        }
    };

    return (
        <View style={styles.htmlWrapper}>
            <Suspense fallback={null}>
                <LazyRenderHTML
                    source={{ html }}
                    contentWidth={contentWidth}
                    // iframe-модель подключаем только когда она реально нужна
                    {...(customHTMLElementModels ? { customHTMLElementModels } : {})}
                    renderers={renderers as any}
                    defaultTextProps={{ selectable: Platform.OS !== "web" }} // на web выбор текста иногда тяжёлый
                    onLinkPress={handleLinkPress}
                    tagsStyles={tagsStyles as any}
                    // мелкая экономия: не рендерить пустые inline-теги
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
