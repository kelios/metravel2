import React, { memo, useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
    Platform,
    InteractionManager,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import StableContent from "@/components/travel/StableContent";

interface TravelDescriptionProps {
    htmlContent: string;
    title?: string;          // ← заголовок может отсутствовать
    noBox?: boolean;
}

/**
 * Описание путешествия с адаптивной высотой и безопасной разметкой.
 * - Корректно работает без title.
 * - contentWidth никогда не уходит в отрицательные значения.
 * - Плашка-штамп не перехватывает клики и не ломает скролл.
 * - Парсинг HTML откладывается до idle, чтобы не жечь main thread.
 */
const TravelDescription: React.FC<TravelDescriptionProps> = ({
                                                                 htmlContent,
                                                                 title,
                                                                 noBox = false,
                                                             }) => {
    const { width, height } = useWindowDimensions();

    // ---- размеры контейнера ----
    const pageHeight = useMemo(() => Math.round(height * 0.7), [height]);
    const contentWidth = useMemo(() => {
        const maxContent = Math.min(width, 900);
        return Math.max(maxContent - 60, 220);
    }, [width]);

    // ---- состояние содержимого ----
    const isEmptyHtml = useMemo(() => {
        if (!htmlContent) return true;
        const txt = String(htmlContent).trim().replace(/<[^>]+>/g, "");
        return txt.length === 0;
    }, [htmlContent]);

    // ---- отложенный рендер тяжёлого HTML ----
    const [canParseHtml, setCanParseHtml] = useState(Platform.OS !== "web" ? false : false);

    useEffect(() => {
        let cancelled = false;

        if (Platform.OS === "web") {
            const arm = () => !cancelled && setCanParseHtml(true);
            if ("requestIdleCallback" in window) {
                // @ts-ignore
                const id = (window as any).requestIdleCallback(arm, { timeout: 1200 });
                return () => {
                    cancelled = true;
                    // @ts-ignore
                    if ((window as any).cancelIdleCallback) (window as any).cancelIdleCallback(id);
                };
            } else {
                const t = setTimeout(arm, 800);
                return () => {
                    cancelled = true;
                    clearTimeout(t);
                };
            }
        } else {
            const task = InteractionManager.runAfterInteractions(() => {
                if (!cancelled) setCanParseHtml(true);
            });
            return () => {
                cancelled = true;
                task.cancel();
            };
        }
    }, [htmlContent]);

    const inner = (
        <View style={styles.inner} pointerEvents="box-none">
            {/* Полупрозрачный штамп в углу — загружаем с низким приоритетом */}
            <ExpoImage
                source={require("@/assets/travel-stamp.webp")}
                style={styles.stamp}
                accessibilityIgnoresInvertColors
                accessible={false}
                pointerEvents="none"
                cachePolicy="memory-disk"
                priority="low"
            />

            {/* Контент */}
            {isEmptyHtml ? (
                <Text style={styles.placeholder}>Описание скоро появится 🙂</Text>
            ) : canParseHtml ? (
                <StableContent html={htmlContent} contentWidth={contentWidth} />
            ) : (
                // лёгкий плейсхолдер на время idle — дешевле, чем сразу парсить HTML
                <Text style={styles.placeholder}>Загружаем описание…</Text>
            )}
        </View>
    );

    return (
        <View style={styles.wrapper} testID="travel-description">
            {noBox ? (
                <ScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.scrollContent}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                    // немного экономим на web
                    {...(Platform.OS === "web" ? { overScrollMode: "never" as any } : {})}
                >
                    {inner}
                </ScrollView>
            ) : (
                <View style={[styles.fixedHeightBlock, { height: pageHeight }]}>
                    <ScrollView
                        style={styles.scrollArea}
                        contentContainerStyle={styles.scrollContent}
                        scrollEventThrottle={16}
                        showsVerticalScrollIndicator
                        keyboardShouldPersistTaps="handled"
                        {...(Platform.OS === "web" ? { overScrollMode: "never" as any } : {})}
                    >
                        {inner}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

export default memo(TravelDescription);

const styles = StyleSheet.create({
    wrapper: {
        alignSelf: "center",
        width: "100%",
        maxWidth: 900,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
        backgroundColor: "transparent",
    },

    inner: {
        position: "relative",
        paddingTop: 6,
    },

    placeholder: {
        textAlign: "center",
        color: "#6b7280",
        fontSize: 15,
        paddingVertical: 8,
    },

    fixedHeightBlock: {
        borderWidth: 1,
        borderColor: "#DDD",
        borderRadius: 10,
        backgroundColor: "#FFF",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },

    scrollArea: {},

    scrollContent: {
        paddingBottom: 8,
    },

    stamp: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 60,
        height: 60,
        opacity: 0.25,
        zIndex: 1,
    },
});
