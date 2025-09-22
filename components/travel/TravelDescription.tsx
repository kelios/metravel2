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
    title?: string;
    noBox?: boolean;
}

/**
 * Описание путешествия:
 * - На web сразу монтируем HTML (иначе могут «пропасть» картинки, если idle не наступает).
 * - На native парсинг откладывается до конца взаимодействий (экономим кадры).
 * - Есть форсажный таймер — через 2s в любом случае монтируем.
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

    // На web — сразу true, на native — откладываем
    const [canParseHtml, setCanParseHtml] = useState(Platform.OS === "web");

    useEffect(() => {
        let cancelled = false;
        let timeoutId: any = null;

        if (Platform.OS !== "web") {
            const task = InteractionManager.runAfterInteractions(() => {
                if (!cancelled) setCanParseHtml(true);
            });

            // Форсаж: если что-то пойдёт не так — смонтировать через 2s
            timeoutId = setTimeout(() => {
                if (!cancelled) setCanParseHtml(true);
            }, 2000);

            return () => {
                cancelled = true;
                task.cancel();
                if (timeoutId) clearTimeout(timeoutId);
            };
        } else {
            // На web всё уже true; но оставим форсаж на всякий
            timeoutId = setTimeout(() => {
                if (!cancelled) setCanParseHtml(true);
            }, 2000);
            return () => {
                cancelled = true;
                if (timeoutId) clearTimeout(timeoutId);
            };
        }
    }, [htmlContent]);

    const inner = (
      <View style={styles.inner} pointerEvents="box-none">
          {/* Полупрозрачный штамп в углу — низкий приоритет, не перехватывает клики */}
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
              {...(Platform.OS === "web" ? ({ overScrollMode: "never" } as any) : {})}
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
                  {...(Platform.OS === "web" ? ({ overScrollMode: "never" } as any) : {})}
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
