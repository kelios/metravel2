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
 * Оптимизированное описание путешествия:
 * - На web сразу монтируем HTML (как и раньше), но заранее правим медиа:
 *    • первой картинке поднимаем приоритет (LCP);
 *    • всем img/iframe прописываем размеры/ленивую загрузку (CLS↓).
 * - На native парсинг откладывается до конца взаимодействий.
 * - Есть форсажный таймер — через 2s в любом случае монтируем.
 */

const LCP_INDEX = 0; // первая картинка из контента — кандидат в LCP

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

    // --- HTML подготовка: поднимаем приоритет LCP и фиксируем медиа ---
    const { preparedHtml, lcpSrc } = useMemo(() => {
        if (!htmlContent) return { preparedHtml: htmlContent, lcpSrc: null as string | null };

        // Небольшой парсер по регуляркам (достаточно для наших задач).
        // 1) Соберём все <img ...>
        const imgRegex = /<img\b[^>]*?>/gi;
        const imgs = Array.from(htmlContent.matchAll(imgRegex)).map(m => m[0]);

        let lcpCandidate: string | null = null;
        let idx = 0;

        let out = htmlContent
          // Видео-облегчалки: YouTube iframe -> постер с кнопкой; iframe по клику (web)
          .replace(
            /<iframe\b[^>]*?(youtube\.com|youtu\.be)[^>]*><\/iframe>/gi,
            (tag) => {
                // Пытаемся вытащить id
                const srcMatch = tag.match(/src="([^"]+)"/i);
                const src = srcMatch ? srcMatch[1] : "";
                const idMatch =
                  src.match(/[?&]v=([a-z0-9_-]{6,})/i) ||
                  src.match(/youtu\.be\/([a-z0-9_-]{6,})/i);
                const vid = idMatch ? idMatch[1] : "";
                if (!vid) return tag; // не распознали — оставляем как есть

                // Легковесный виджет: картинка-превью (не дергает раскладку) + кнопка
                const poster = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
                // Резервируем место ~16:9, можно поправить через style
                return `
<div class="yt-lite" data-yt="${vid}" style="position:relative;aspect-ratio:16/9;background:#000;overflow:hidden;border-radius:8px">
  <img src="${poster}" alt="YouTube preview" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover" />
  <button aria-label="Смотреть видео" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer">
    <span style="width:68px;height:48px;background:rgba(0,0,0,.6);clip-path:polygon(20% 10%, 20% 90%, 85% 50%);"></span>
  </button>
</div>`;
            }
          )
          // 2) Каждой картинке: width/height (если есть), height:auto, lazy (кроме LCP), fetchpriority
          .replace(imgRegex, (tag) => {
              // src
              const srcMatch = tag.match(/\bsrc="([^"]+)"/i);
              const src = srcMatch?.[1] ?? "";

              // width/height из атрибутов (WordPress обычно проставляет)
              const wMatch = tag.match(/\bwidth="(\d+)"/i);
              const hMatch = tag.match(/\bheight="(\d+)"/i);
              const w = wMatch ? parseInt(wMatch[1], 10) : undefined;
              const h = hMatch ? parseInt(hMatch[1], 10) : undefined;

              // если нет размеров — попробуем выдернуть из имени файла ...-1200x800.jpg
              let ww = w, hh = h;
              if (!ww || !hh) {
                  const wh = src.match(/[-_](\d{2,5})x(\d{2,5})\.(jpg|jpeg|png|webp|avif)(\?|$)/i);
                  if (wh) {
                      ww = ww || parseInt(wh[1], 10);
                      hh = hh || parseInt(wh[2], 10);
                  }
              }

              // базовые атрибуты
              const hasLoading = /\bloading=/i.test(tag);
              const hasDecoding = /\bdecoding=/i.test(tag);
              const hasFetchPriority = /\bfetchpriority=/i.test(tag);

              // стили
              const styleMatch = tag.match(/\bstyle="([^"]*)"/i);
              const style = styleMatch?.[1] ?? "";
              const styleWithHeightAuto =
                style.includes("height") ? style : (style ? `${style};height:auto` : "height:auto");

              // LCP — первая картинка в документе: high priority, не lazy
              const isLcp = idx === LCP_INDEX;
              if (isLcp && src) lcpCandidate = src;

              const patched = tag
                // добавим/заменим style (height:auto)
                .replace(styleMatch ? styleMatch[0] : "", "")
                .replace(/>$/, ` style="${styleWithHeightAuto}">`)
                // установим размеры (если вычислили)
                .replace(/\bwidth="[^"]*"/i, "")
                .replace(/\bheight="[^"]*"/i, "")
                .replace(/>$/, ww && hh ? ` width="${ww}" height="${hh}">` : ">")
                // loading/decoding/fetchpriority
                .replace(/\bloading="[^"]*"/i, "")
                .replace(/\bdecoding="[^"]*"/i, "")
                .replace(/\bfetchpriority="[^"]*"/i, "")
                .replace(
                  />$/,
                  isLcp
                    ? ` fetchpriority="high" decoding="async">`
                    : ` loading="lazy" decoding="async" fetchpriority="low">`
                );

              idx += 1;
              return patched;
          });

        return { preparedHtml: out, lcpSrc: lcpCandidate };
    }, [htmlContent]);

    // Предзагрузка LCP-картинки на web (ускоряет LCP)
    useEffect(() => {
        if (Platform.OS !== "web" || !lcpSrc) return;
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = lcpSrc;
        // Подстрахуемся, если это cross-origin
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, [lcpSrc]);

    // Навесим делегат на легкий YouTube (загрузить iframe по клику) — только web
    useEffect(() => {
        if (Platform.OS !== "web") return;

        const handler = (e: any) => {
            const root = (e.target as HTMLElement)?.closest?.(".yt-lite") as HTMLElement | null;
            if (!root) return;
            const vid = root.getAttribute("data-yt");
            if (!vid) return;

            // Создаем iframe только по клику
            const iframe = document.createElement("iframe");
            iframe.width = "560";
            iframe.height = "315";
            iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`;
            iframe.title = "YouTube video";
            iframe.allow =
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
            iframe.allowFullscreen = true;
            iframe.style.position = "absolute";
            iframe.style.inset = "0";
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            root.innerHTML = "";
            root.appendChild(iframe);
        };

        document.addEventListener("click", handler, { passive: true });
        return () => {
            document.removeEventListener("click", handler as any);
        };
    }, []);

    const inner = (
      <View style={styles.inner} pointerEvents="box-none">
          {/* Декоративный штамп — не участвует в доступности и не перехватывает клики */}
          <ExpoImage
            source={require("@/assets/travel-stamp.webp")}
            style={styles.stamp}
            accessibilityIgnoresInvertColors
            accessible={false}
            pointerEvents="none"
            cachePolicy="memory-disk"
            priority="low"
            contentFit="contain"
            transition={0}
          />

          {/* Контент */}
          {isEmptyHtml ? (
            <Text style={styles.placeholder}>Описание скоро появится 🙂</Text>
          ) : canParseHtml ? (
            <StableContent html={preparedHtml} contentWidth={contentWidth} />
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
