import React, { memo, useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    Platform,
    InteractionManager,
} from "react-native";
import ImageCardMedia from "@/components/ui/ImageCardMedia";
import StableContent from "@/components/travel/StableContent";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useResponsive } from '@/hooks/useResponsive';
import { useThemedColors } from '@/hooks/useTheme';

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
                                                                 noBox = false,
                                                             }) => {
    const { width, height } = useResponsive();
    const isMobileLayout = width < 768;
    const colors = useThemedColors();

    // ✅ ОПТИМИЗАЦИЯ: Адаптивные размеры контейнера
    const pageHeight = useMemo(() => Math.round(height * 0.7), [height]);
    const contentWidth = useMemo(() => {
        // Адаптивная максимальная ширина
        const maxContent = Math.min(width, 760);
        // Адаптивные отступы в зависимости от ширины
        const padding = width >= 768 ? 64 : width >= 480 ? 40 : 32;
        return Math.max(maxContent - padding, 220);
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
    const { preparedHtml } = useMemo(() => {
        if (!htmlContent) return { preparedHtml: htmlContent };

        // Небольшой парсер по регуляркам (достаточно для наших задач).
        // 1) Соберём все <img ...>
        const imgRegex = /<img\b[^>]*?>/gi;

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
<div class="yt-lite" data-yt="${vid}" style="position:relative;aspect-ratio:16/9;background:var(--color-backgroundTertiary);overflow:hidden;border-radius:8px">
  <img src="${poster}" alt="YouTube preview" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover" />
  <div role="button" tabindex="0" aria-label="Смотреть видео"
       style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:transparent;cursor:pointer">
    <span style="width:68px;height:48px;background:var(--color-overlay);clip-path:polygon(20% 10%, 20% 90%, 85% 50%);"></span>
  </div>
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
              // стили
              const styleMatch = tag.match(/\bstyle="([^"]*)"/i);
              const style = styleMatch?.[1] ?? "";
              const baseResponsiveStyle = "max-width:100%;height:auto;display:block;object-fit:contain";
              const styleWithResponsiveDefaults = style
                ? `${style};${baseResponsiveStyle}`
                : baseResponsiveStyle;

              // LCP — первая картинка в документе: high priority, не lazy
              const isLcp = idx === LCP_INDEX;

              const patched = tag
                // добавим/заменим style (height:auto)
                .replace(styleMatch ? styleMatch[0] : "", "")
                .replace(/>$/, ` style="${styleWithResponsiveDefaults}">`)
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

        return { preparedHtml: out };
    }, [htmlContent]);

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

    const styles = useMemo(() => StyleSheet.create({
        // ✅ РЕДИЗАЙН: Улучшенный контейнер с современными стилями
        wrapper: {
            alignSelf: "center",
            width: "100%",
            maxWidth: 760,
            paddingHorizontal: Platform.select({
                web: 32,
                default: 16
            }),
            paddingTop: Platform.select({
                web: 32,
                default: 24
            }),
            paddingBottom: Platform.select({
                web: 48,
                default: 32
            }),
            backgroundColor: colors.surface,
        },

        wrapperNoBoxMobile: {
            alignSelf: "stretch",
            maxWidth: undefined,
            paddingHorizontal: 0,
            paddingTop: 0,
            paddingBottom: 0,
        },

        inner: {
            position: "relative",
            paddingTop: 8,
        },

        placeholder: {
            textAlign: "center",
            color: colors.textMuted,
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            paddingVertical: DESIGN_TOKENS.spacing.xxs,
            fontFamily: "Georgia",
        },

        fixedHeightBlock: {
            borderWidth: 1,
            borderColor: colors.borderLight,
            borderRadius: Platform.select({ web: 16, default: 12 }),
            backgroundColor: colors.surface,
            overflow: "hidden",
            ...Platform.select({
                web: {
                    // @ts-ignore: web-only style
                    boxShadow: colors.isDark
                        ? '0 8px 24px rgba(0, 0, 0, 0.3)'
                        : '0 8px 24px rgba(0, 0, 0, 0.08)',
                },
                ios: {
                    shadowColor: colors.text,
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                },
                android: {
                    elevation: 2,
                },
                default: {
                    shadowColor: colors.text,
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                },
            }),
        },

        scrollArea: {},

        scrollContent: {
            paddingBottom: DESIGN_TOKENS.spacing.lg,
        },

        stamp: {
            position: "absolute",
            top: 8,
            right: 8,
            width: Platform.select({ web: 80, default: 60 }),
            height: Platform.select({ web: 80, default: 60 }),
            opacity: 0.15,
            zIndex: 1,
        },
    }), [colors]);

    const inner = (
      <View
        style={[
          styles.inner,
          { pointerEvents: 'box-none' } as any,
        ]}
      >
          {/* Декоративный штамп — не участвует в доступности и не перехватывает клики */}
          <ImageCardMedia
            source={require("@/assets/travel-stamp.webp")}
            fit="contain"
            blurBackground={false}
            transition={0}
            loading="lazy"
            priority="low"
            style={[
              styles.stamp,
              { pointerEvents: 'none' } as any,
            ]}
          />

          {/* Контент */}
          {isEmptyHtml ? (
            <Text style={styles.placeholder}>Описание скоро появится</Text>
          ) : canParseHtml ? (
            <StableContent html={preparedHtml} contentWidth={contentWidth} />
          ) : (
            <Text style={styles.placeholder}>Загружаем описание…</Text>
          )}
      </View>
    );

    return (
      <View
        style={[
          styles.wrapper,
          noBox && isMobileLayout && styles.wrapperNoBoxMobile,
        ]}
        testID="travel-description"
      >
        {noBox ? (
          Platform.OS === 'web' ? (
            <View style={[styles.scrollArea, styles.scrollContent]}>{inner}</View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {inner}
            </ScrollView>
          )
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
