import React, { useEffect, useMemo, useState } from "react";
import { View, Platform, useWindowDimensions, ActivityIndicator, Text } from "react-native";
import { CustomRendererProps } from "react-native-render-html";
import { Image as ExpoImage } from "expo-image";

interface CustomImageRendererProps extends CustomRendererProps {
    contentWidth: number;
}

const MIN_HEIGHT = 160;

const CustomImageRenderer = ({ tnode, contentWidth }: CustomImageRendererProps) => {
    const src = tnode.attributes?.src || "";
    const alt = tnode.attributes?.alt || "image";

    // Пытаемся взять размеры прямо из HTML (если парсер их сохранил)
    const attWidth  = tnode.attributes?.width  ? Number(tnode.attributes.width)  : undefined;
    const attHeight = tnode.attributes?.height ? Number(tnode.attributes.height) : undefined;
    const attrAspect = attWidth && attHeight && attHeight !== 0 ? attWidth / attHeight : null;

    const { height: screenHeight } = useWindowDimensions();
    const [aspectRatio, setAspectRatio] = useState<number | null>(attrAspect ?? null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    if (!src) return null;

    // Ширина картинки внутри контейнера
    const imageWidth = useMemo(() => Math.max(220, Math.round(contentWidth * 0.96)), [contentWidth]);

    // Если нет размеров в атрибутах — один раз аккуратно определим (на native)
    useEffect(() => {
        let mounted = true;
        setErr(null);
        setLoading(true);

        if (Platform.OS === "web") {
            // На web expo-image сам установит размеры после загрузки; не блокируем поток.
            setLoading(false);
            if (!aspectRatio) {
                // дадим безопасный фолбек — пересчитаем по факту в onLoad через CSS естественно
                setAspectRatio(null);
            }
            return () => { mounted = false; };
        }

        if (attrAspect) {
            setAspectRatio(attrAspect);
            setLoading(false);
            return () => { mounted = false; };
        }

        // Нативный лёгкий замер
        // @ts-ignore expo-image не имеет getSize — используем Image.getSize через RN только при необходимости
        const { Image } = require("react-native");
        Image.getSize(
            src,
            (w: number, h: number) => {
                if (mounted) {
                    if (h > 0) setAspectRatio(w / h);
                    setLoading(false);
                }
            },
            () => {
                if (mounted) {
                    setAspectRatio(null);
                    setLoading(false);
                }
            }
        );

        return () => { mounted = false; };
    }, [src, attrAspect]);

    const computedHeight = useMemo(() => {
        if (aspectRatio && aspectRatio > 0) {
            const h = Math.max(MIN_HEIGHT, Math.round(imageWidth / aspectRatio));
            // для «длинных» вертикальных — ограничим 80% высоты экрана
            return aspectRatio < 0.75 ? Math.min(h, Math.round(screenHeight * 0.8)) : h;
        }
        return MIN_HEIGHT;
    }, [aspectRatio, imageWidth, screenHeight]);

    const wrapperStyle = useMemo(
        () => ({
            marginVertical: 16,
            alignItems: "center" as const,
            backgroundColor: "#f8f8f8",
            borderRadius: 12,
            padding: 6,
        }),
        []
    );

    const imgStyle = useMemo(
        () => ({
            width: imageWidth,
            height: computedHeight,
            borderRadius: 8,
        }),
        [imageWidth, computedHeight]
    );

    // Ветка WEB: expo-image отрендерит <img>, добавим lazy/decoding/fetchpriority
    const webNativeAttrs =
        Platform.OS === "web"
            ? ({
                // эти пропы пробрасываются до <img>
                loading: "lazy",
                decoding: "async",
                fetchpriority: "low",
                // Заодно позволим браузеру сам масштабировать
                style: { objectFit: "contain" },
            } as any)
            : {};

    return (
        <View style={wrapperStyle}>
            {err ? (
                <Text style={{ color: "#888", padding: 8 }}>Не удалось загрузить изображение</Text>
            ) : loading && !aspectRatio ? (
                <ActivityIndicator size="small" />
            ) : (
                <ExpoImage
                    source={{ uri: src }}
                    style={imgStyle as any}
                    contentFit="contain"
                    transition={120}
                    cachePolicy="disk"
                    priority="low"
                    accessibilityLabel={alt}
                    accessibilityIgnoresInvertColors
                    onError={() => setErr("load")}
                    {...webNativeAttrs}
                />
            )}
        </View>
    );
};

export default CustomImageRenderer;
