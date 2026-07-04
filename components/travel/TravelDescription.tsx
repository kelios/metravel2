import React, { memo, useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    Platform,
    InteractionManager,
    useWindowDimensions,
} from "react-native";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { METRICS } from '@/constants/layout';
import { useThemedColors } from '@/hooks/useTheme';
import StableContent from '@/components/travel/StableContent';

interface TravelDescriptionProps {
    htmlContent: string;
    title?: string;
    noBox?: boolean;
    // htmlContent — серверный canonical safe_html (#709): без полного sanitize, только дешёвый guard
    serverSanitized?: boolean;
}

/**
 * Оптимизированное описание путешествия:
 * - На web монтаж HTML откладываем на пару кадров + idle: синхронный mount большого
 *   описания (десятки KB + Instagram-фасады) во время гидратации RN Web блокирует
 *   появление hero/шапки и держит SSG-скелет видимым 10+ секунд на тяжёлых статьях.
 *   Прероллится только скелет (в #root описания нет) → mismatch'а гидратации не будет.
 * - На native парсинг откладывается до конца взаимодействий (InteractionManager + 2s форсаж).
 */

const TravelDescription: React.FC<TravelDescriptionProps> = ({
                                                                 htmlContent,
                                                                 noBox = false,
                                                                 serverSanitized = false,
                                                             }) => {
    const { width, height } = useWindowDimensions();
    const isMobileLayout = width < METRICS.breakpoints.tablet;
    const colors = useThemedColors();
    const shouldUseFullWidthLayout = noBox && !isMobileLayout;

    // ✅ ОПТИМИЗАЦИЯ: Адаптивные размеры контейнера
    const pageHeight = useMemo(() => Math.round(height * 0.7), [height]);
    const contentWidth = useMemo(() => {
        const maxContent = shouldUseFullWidthLayout ? width : Math.min(width, 760);
        const padding = shouldUseFullWidthLayout
            ? (width >= 768 ? 32 : width >= 480 ? 24 : 16)
            : (width >= 768 ? 64 : width >= 480 ? 40 : 32);
        return Math.max(maxContent - padding, 220);
    }, [shouldUseFullWidthLayout, width]);

    // ---- состояние содержимого ----
    const isEmptyHtml = useMemo(() => {
        if (!htmlContent) return true;
        const txt = String(htmlContent).trim().replace(/<[^>]+>/g, "");
        return txt.length === 0;
    }, [htmlContent]);

    // «Вес» описания: лёгкое (короткий текст без эмбедов/множества фото) можно
    // монтировать сразу после кадров гидратации — idle-gate для него лишняя задержка.
    // estimatedHeight — резерв высоты плейсхолдера, чтобы swap placeholder→контент
    // не давал крупного CLS (#561).
    const { isHeavyHtml, estimatedHeight } = useMemo(() => {
        const raw = String(htmlContent || '');
        const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const imgCount = (raw.match(/<img/gi) || []).length;
        const embedCount = (raw.match(/instagram\.com|<iframe/gi) || []).length;
        const heavy = raw.length > 6000 || embedCount > 0 || imgCount > 4;
        const charsPerLine = Math.max(28, Math.round(contentWidth / 8));
        const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
        const reserve = Math.min(Math.max(lines * 26 + imgCount * 240 + embedCount * 420, 120), 4000);
        return { isHeavyHtml: heavy, estimatedHeight: reserve };
    }, [htmlContent, contentWidth]);

    // Монтаж тяжёлого HTML откладываем на обеих платформах, чтобы не блокировать
    // первый интерактив (web: гидратация шелла/hero; native: взаимодействия).
    const [canParseHtml, setCanParseHtml] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const reveal = () => {
            if (!cancelled) setCanParseHtml(true);
        };

        if (Platform.OS === "web") {
            const w = typeof window !== "undefined" ? (window as any) : null;
            let idleId: number | null = null;
            // Лёгкое описание раскрываем сразу после hydration effect: рендер был
            // одинаковым на первом клиентском проходе, поэтому mismatch'а нет, а
            // пользователь не ждёт idle/rAF-ворота (#557). Тяжёлое HTML оставляем
            // за idle-gate, чтобы не блокировать hero/шапку.
            if (!isHeavyHtml) {
                reveal();
                return () => {
                    cancelled = true;
                };
            }

            const rafOuter = w?.requestAnimationFrame
                ? w.requestAnimationFrame(() => {
                      w.requestAnimationFrame(() => {
                          if (w.requestIdleCallback) {
                              idleId = w.requestIdleCallback(reveal, { timeout: 600 });
                          } else {
                              reveal();
                          }
                      });
                  })
                : null;
            const timeoutId = setTimeout(reveal, 800);

            return () => {
                cancelled = true;
                if (rafOuter != null && w?.cancelAnimationFrame) w.cancelAnimationFrame(rafOuter);
                if (idleId != null && w?.cancelIdleCallback) w.cancelIdleCallback(idleId);
                clearTimeout(timeoutId);
            };
        }

        const task = InteractionManager.runAfterInteractions(reveal);
        // Форсаж: если что-то пойдёт не так — смонтировать через 2s
        const timeoutId = setTimeout(reveal, 2000);

        return () => {
            cancelled = true;
            task.cancel();
            clearTimeout(timeoutId);
        };
    }, [htmlContent, isHeavyHtml]);

    const styles = useMemo(() => StyleSheet.create({
        // ✅ РЕДИЗАЙН: Улучшенный контейнер с современными стилями
        wrapper: {
            alignSelf: "center",
            width: "100%",
            maxWidth: 760,
            paddingHorizontal: Platform.select({
                web: 0,
                default: 16
            }),
            paddingTop: Platform.select({
                web: 24,
                default: 20
            }),
            paddingBottom: Platform.select({
                web: 40,
                default: 28
            }),
            backgroundColor: 'transparent',
        },

        wrapperNoBox: {
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
            
        },

        fixedHeightBlock: {
            borderWidth: 1,
            borderColor: colors.borderLight,
            borderRadius: DESIGN_TOKENS.radii.md,
            backgroundColor: colors.surface,
            overflow: "hidden",
        },

        scrollArea: {},

        scrollContent: {
            paddingBottom: DESIGN_TOKENS.spacing.lg,
        },

        webLazyContentFallback: {
            width: '100%',
            minHeight: 320,
            justifyContent: 'center',
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
          {/* P1-6: Декоративный штамп удалён — добавлял визуальный шум и лишний запрос */}

          {/* Контент */}
          {isEmptyHtml ? (
            <Text style={styles.placeholder}>Автор ещё не добавил описание</Text>
          ) : canParseHtml ? (
            <StableContent html={htmlContent} contentWidth={contentWidth} fullWidth={noBox} serverSanitized={serverSanitized} />
          ) : (
            <View
              testID="travel-description-fallback"
              style={
                Platform.OS === "web"
                  ? [styles.webLazyContentFallback, { minHeight: estimatedHeight }]
                  : undefined
              }
            >
              <Text style={styles.placeholder}>Загружаем описание…</Text>
            </View>
          )}
      </View>
    );

    return (
      <View
        style={[
          styles.wrapper,
          noBox && styles.wrapperNoBox,
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
