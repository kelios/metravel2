// components/SafeHtml.tsx
// ✅ БЕЗОПАСНОСТЬ: Компонент для безопасного рендеринга HTML контента

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { sanitizeRichText } from '@/src/utils/sanitizeRichText';

interface SafeHtmlProps {
    html: string;
    style?: any;
    className?: string;
    testID?: string;
}

/**
 * Компонент для безопасного рендеринга HTML контента
 * Автоматически санитизирует HTML для защиты от XSS
 */
export function SafeHtml({ html, style, className, testID }: SafeHtmlProps) {
    if (!html || html.trim() === '') {
        return null;
    }

    // Санитизируем HTML
    const sanitized = sanitizeRichText(html);

    if (Platform.OS === 'web') {
        return (
            <div
                className={className}
                style={style}
                dangerouslySetInnerHTML={{ __html: sanitized }}
                data-testid={testID}
            />
        );
    }

    // Для React Native используем WebView или рендеринг через react-native-render-html
    // В данном случае используем простой текст, так как полный HTML рендеринг требует WebView
    return (
        <View style={[styles.container, style]} testID={testID}>
            <Text style={styles.text}>
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

/**
 * Хук для использования SafeHtml с дополнительными опциями
 */
export function useSafeHtml(html: string | null | undefined): string {
    if (!html) return '';
    return sanitizeRichText(html);
}

