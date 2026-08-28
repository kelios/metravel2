import React, { memo, useEffect, useMemo, useRef, useState } from "react";
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
import DeferredStableContent from '@/components/travel/DeferredStableContent';
import type { ArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia';
import { translate as i18nT } from '@/i18n'


interface TravelDescriptionProps {
    htmlContent: string;
    title?: string;
    noBox?: boolean;
    // htmlContent — серверный canonical safe_html (#709): без полного sanitize, только дешёвый guard
    serverSanitized?: boolean;
    // #1256: индекс `media.article_body`. Есть только у тела статьи: у «Рекомендаций»,
    // «Плюсов» и «Минусов» манифеста нет, и они остаются на клиентской сборке URL.
    articleBodyMedia?: ArticleBodyMediaIndex | null;
}

const HEAVY_HTML_REVEAL_ROOT_MARGIN = '0px 0px 400px 0px';
const OBSERVER_ATTACH_RETRY_MS = 50;
const OBSERVER_ATTACH_RETRY_LIMIT = 20;

function resolveWebElement(node: unknown): Element | null {
    if (node == null || typeof Element === 'undefined') return null;
    if (node instanceof Element) return node;
    if (typeof node !== 'object') return null;
    const host = node as { getNativeNode?: () => unknown; _nativeNode?: unknown };
    const native = typeof host.getNativeNode === 'function' ? host.getNativeNode() : host._nativeNode;
    return native instanceof Element ? native : null;
}

/**
 * Оптимизированное описание путешествия:
 * - На web монтаж тяжёлого HTML ждёт приближения плейсхолдера к viewport + idle:
 *   синхронный mount большого описания (десятки KB + Instagram-фасады) во время
 *   гидратации RN Web блокирует первый интерактив.
 *   Прероллится только скелет (в #root описания нет) → mismatch'а гидратации не будет.
 * - На native парсинг откладывается до конца взаимодействий (InteractionManager + 2s форсаж).
 */

const TravelDescription: React.FC<TravelDescriptionProps> = ({
                                                                 htmlContent,
                                                                 noBox = false,
                                                                 serverSanitized = false,
                                                                 articleBodyMedia = null,
                                                             }) => {
    const { width, height } = useWindowDimensions();
    const isMobileLayout = width < METRICS.breakpoints.tablet;
    const colors = useThemedColors();
    const shouldUseFullWidthLayout = noBox && !isMobileLayout;
    const descriptionRef = useRef<View | null>(null);

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
    const [revealedHtml, setRevealedHtml] = useState<string | null>(null);
    const canParseHtml = revealedHtml === htmlContent;

    useEffect(() => {
        let cancelled = false;
        const reveal = () => {
            if (!cancelled) setRevealedHtml(htmlContent);
        };

        if (Platform.OS === "web") {
            const w = typeof window !== "undefined" ? (window as any) : null;
            let idleId: number | null = null;
            let observer: { observe: (target: unknown) => void; disconnect: () => void } | null = null;
            let revealTimeoutId: ReturnType<typeof setTimeout> | null = null;
            let revealScheduled = false;
            // Лёгкое описание раскрываем сразу после hydration effect: рендер был
            // одинаковым на первом клиентском проходе, поэтому mismatch'а нет, а
            // пользователь не ждёт proximity/idle-ворота (#557).
            if (!isHeavyHtml) {
                reveal();
                return () => {
                    cancelled = true;
                };
            }

            // #1552: тяжёлое тело статьи находится ниже первого экрана. Прежний
            // безусловный reveal через 800 мс запускал prepareStableContentHtml во
            // время поздней гидратации и добавлял 179–215 мс к production TBT.
            // Готовим HTML, когда зарезервированный плейсхолдер приблизился к
            // viewport, а затем отдаём работу первому idle-окну.
            const scheduleReveal = () => {
                if (cancelled || revealScheduled) return;
                revealScheduled = true;
                if (w?.requestIdleCallback) {
                    idleId = w.requestIdleCallback(reveal, { timeout: 600 });
                } else {
                    revealTimeoutId = setTimeout(reveal, 0);
                }
            };

            const Observer = w?.IntersectionObserver;
            let attachRetryCount = 0;
            const attachObserver = (): boolean => {
                if (typeof Observer !== 'function') {
                    scheduleReveal();
                    return true;
                }
                const target = resolveWebElement(descriptionRef.current) ?? descriptionRef.current;
                if (!target) return false;
                let created: { observe: (node: unknown) => void; disconnect: () => void }
                try {
                    created = new Observer(
                        (entries: Array<{
                            isIntersecting?: boolean;
                            intersectionRatio?: number;
                        }>) => {
                            const hasReachedDescription = entries.some((entry) =>
                                entry.isIntersecting ||
                                Number(entry.intersectionRatio) > 0
                            );
                            if (hasReachedDescription) {
                                observer?.disconnect();
                                scheduleReveal();
                            }
                        },
                        { rootMargin: HEAVY_HTML_REVEAL_ROOT_MARGIN, threshold: 0.01 },
                    )
                } catch {
                    observer = null;
                    scheduleReveal();
                    return true;
                }
                observer = created
                try {
                    created.observe(target);
                    return true;
                } catch {
                    created.disconnect();
                    observer = null;
                    return false;
                }
            };

            if (!attachObserver()) {
                const retryAttach = () => {
                    if (cancelled || revealScheduled) return;
                    if (attachObserver()) return;
                    attachRetryCount += 1;
                    if (attachRetryCount >= OBSERVER_ATTACH_RETRY_LIMIT) {
                        scheduleReveal();
                        return;
                    }
                    revealTimeoutId = setTimeout(retryAttach, OBSERVER_ATTACH_RETRY_MS);
                };
                revealTimeoutId = setTimeout(retryAttach, 0);
            }

            return () => {
                cancelled = true;
                observer?.disconnect();
                if (idleId != null && w?.cancelIdleCallback) w.cancelIdleCallback(idleId);
                if (revealTimeoutId) clearTimeout(revealTimeoutId);
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

    const contentFallback = (
      <View
        testID="travel-description-fallback"
        style={
          Platform.OS === "web"
            ? [styles.webLazyContentFallback, { minHeight: estimatedHeight }]
            : undefined
        }
      >
        <Text style={styles.placeholder}>{i18nT('travel:components.travel.TravelDescription.zagruzhaem_opisanie_4a65d6c3')}</Text>
      </View>
    );

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
            <Text style={styles.placeholder}>{i18nT('travel:components.travel.TravelDescription.avtor_esche_ne_dobavil_opisanie_ce4c5ca8')}</Text>
          ) : canParseHtml ? (
            <DeferredStableContent
              html={htmlContent}
              contentWidth={contentWidth}
              fullWidth={noBox}
              serverSanitized={serverSanitized}
              articleBodyMedia={articleBodyMedia}
              fallback={contentFallback}
            />
          ) : (
            contentFallback
          )}
      </View>
    );

    return (
      <View
        ref={descriptionRef}
        collapsable={false}
        style={[
          styles.wrapper,
          noBox && styles.wrapperNoBox,
        ]}
        testID="travel-description"
      >
        {noBox ? (
          // Travel details already owns the vertical ScrollView. A second,
          // unconstrained native ScrollView here competes for every gesture and
          // makes a long article feel viscous even though it has no independent
          // scroll range. Keep the content in the parent's single scroll chain.
          <View style={[styles.scrollArea, styles.scrollContent]}>{inner}</View>
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
