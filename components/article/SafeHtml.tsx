// components/SafeHtml.tsx
// ✅ БЕЗОПАСНОСТЬ: Компонент для безопасного рендеринга HTML контента

import { useEffect, useInsertionEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { normalizeArticleEditorHtmlForInput } from '@/components/article/articleEditorConfig';
import { useThemedColors } from '@/hooks/useTheme';
import { getInstagramCardStyles, replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText';
import { sanitizeRichText } from '@/utils/sanitizeRichText';

interface SafeHtmlProps {
    html: string;
    style?: any;
    className?: string;
    testID?: string;
}

const SAFE_HTML_RICH_TEXT_CLASS = 'safe-html-rich-text';
const SAFE_HTML_RICH_TEXT_STYLES_ID = 'safe-html-rich-text-styles';

/**
 * Компонент для безопасного рендеринга HTML контента
 * Автоматически санитизирует HTML для защиты от XSS
 */
export function SafeHtml({ html, style, className, testID }: SafeHtmlProps) {
    const colors = useThemedColors();
    const trimmed = String(html ?? '').trim();

    // Санитизируем HTML
    const sanitized = useMemo(() => {
        if (!trimmed) return '';
        return sanitizeRichText(replaceInstagramEmbedsWithCards(normalizeArticleEditorHtmlForInput(html)));
    }, [html, trimmed]);
    const richTextStyles = useMemo(
        () => getInstagramCardStyles(`.${SAFE_HTML_RICH_TEXT_CLASS}`, colors),
        [colors]
    );
    const webRootRef = useRef<HTMLElement | null>(null);

    useInsertionEffect(() => {
        if (Platform.OS !== 'web') return;
        if (typeof document === 'undefined') return;

        const existing = document.getElementById(SAFE_HTML_RICH_TEXT_STYLES_ID) as HTMLStyleElement | null;
        if (existing) {
            existing.textContent = richTextStyles;
            return;
        }

        const styleEl = document.createElement('style');
        styleEl.id = SAFE_HTML_RICH_TEXT_STYLES_ID;
        styleEl.textContent = richTextStyles;
        document.head.appendChild(styleEl);
    }, [richTextStyles]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        if (typeof document === 'undefined') return;
        if (typeof window === 'undefined') return;

        const scrollToHashTarget = (hash: string) => {
            try {
                const raw = String(hash || '');
                if (!raw.startsWith('#')) return false;
                const id = decodeURIComponent(raw.slice(1));
                if (!id) return false;
                const escaped = (globalThis as any).CSS?.escape ? (globalThis as any).CSS.escape(id) : id;
                const el =
                    document.getElementById(id) ||
                    (document.querySelector(`[name="${escaped}"]`) as HTMLElement | null);
                if (!el) return false;
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return true;
            } catch {
                return false;
            }
        };

        const onClick = (e: any) => {
            const root = webRootRef.current;
            if (!root) return;
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const anchor = target.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
            if (!anchor) return;
            if (!root.contains(anchor)) return;
            const href = anchor.getAttribute('href') || '';
            if (!href.startsWith('#')) return;
            const didScroll = scrollToHashTarget(href);
            if (didScroll) {
                e.preventDefault?.();
                try {
                    window.history.pushState(null, '', href);
                } catch {
                    window.location.hash = href;
                }
            }
        };

        document.addEventListener('click', onClick);

        const hash = window.location.hash;
        let cancelled = false;
        let tries = 0;
        const maxTries = 20;
        const intervalMs = 150;
        let intervalId: number | null = null;

        const tick = () => {
            if (cancelled) return;
            tries += 1;
            const done = scrollToHashTarget(hash);
            if (done || tries >= maxTries) {
                cancelled = true;
                if (intervalId != null) window.clearInterval(intervalId);
                intervalId = null;
            }
        };

        if (hash) {
            intervalId = window.setInterval(tick, intervalMs);
            window.setTimeout(tick, 0);
        }

        return () => {
            document.removeEventListener('click', onClick as any);
            cancelled = true;
            if (intervalId != null) window.clearInterval(intervalId);
        };
    }, [sanitized]);

    if (!trimmed) {
        return null;
    }

    if (Platform.OS === 'web') {
        const combinedClassName = className
            ? `${SAFE_HTML_RICH_TEXT_CLASS} ${className}`
            : SAFE_HTML_RICH_TEXT_CLASS;

        return (
            <div
                className={combinedClassName}
                style={style}
                ref={(node) => {
                    webRootRef.current = node;
                }}
                dangerouslySetInnerHTML={{ __html: sanitized }}
                data-testid={testID}
            />
        );
    }

    // Для React Native используем WebView или рендеринг через react-native-render-html
    // В данном случае используем простой текст, так как полный HTML рендеринг требует WebView
    return (
        <View style={[styles.container, style]} testID={testID}>
            <Text style={[styles.text, { color: colors.text }]}>
                {/* Удаляем HTML теги для простого отображения в React Native */}
                {sanitized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    text: {
        fontSize: 14,
        lineHeight: 20,
    },
});
