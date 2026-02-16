import React, { memo, useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    Platform,
    InteractionManager,
} from "react-native";
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
 * - На web сразу монтируем HTML; медиа-оптимизация (LCP, CLS, lazy, YouTube lite) — в StableContent.
 * - На native парсинг откладывается до конца взаимодействий (InteractionManager + 2s форсаж).
 */

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
        if (Platform.OS === "web") return;

        let cancelled = false;
        const task = InteractionManager.runAfterInteractions(() => {
            if (!cancelled) setCanParseHtml(true);
        });

        // Форсаж: если что-то пойдёт не так — смонтировать через 2s
        const timeoutId = setTimeout(() => {
            if (!cancelled) setCanParseHtml(true);
        }, 2000);

        return () => {
            cancelled = true;
            task.cancel();
            clearTimeout(timeoutId);
        };
    }, [htmlContent]);

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
            backgroundColor: 'transparent',
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
            <Text style={styles.placeholder}>Описание скоро появится</Text>
          ) : canParseHtml ? (
            <StableContent html={htmlContent} contentWidth={contentWidth} />
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
