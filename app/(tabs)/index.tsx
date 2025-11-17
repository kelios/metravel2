// app/travel/index.tsx
import React, { useMemo, memo, useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ListTravel from '@/components/listTravel/ListTravel';
import InstantSEO from '@/components/seo/InstantSEO';

const PERSONALIZATION_VISIBLE_KEY = 'personalization_visible';
const WEEKLY_HIGHLIGHTS_VISIBLE_KEY = 'weekly_highlights_visible';

function TravelScreen() {
    const pathname = usePathname();
    const isFocused = useIsFocused();

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';

    // Состояние видимости блоков (по умолчанию показываются)
    const [isPersonalizationVisible, setIsPersonalizationVisible] = useState(true);
    const [isWeeklyHighlightsVisible, setIsWeeklyHighlightsVisible] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // Загружаем сохраненное состояние видимости
    useEffect(() => {
        const loadVisibility = async () => {
            try {
                if (Platform.OS === 'web') {
                    const personalizationVisible = sessionStorage.getItem(PERSONALIZATION_VISIBLE_KEY);
                    const weeklyHighlightsVisible = sessionStorage.getItem(WEEKLY_HIGHLIGHTS_VISIBLE_KEY);
                    
                    setIsPersonalizationVisible(personalizationVisible !== 'false');
                    setIsWeeklyHighlightsVisible(weeklyHighlightsVisible !== 'false');
                } else {
                    const [personalizationVisible, weeklyHighlightsVisible] = await Promise.all([
                        AsyncStorage.getItem(PERSONALIZATION_VISIBLE_KEY),
                        AsyncStorage.getItem(WEEKLY_HIGHLIGHTS_VISIBLE_KEY),
                    ]);
                    
                    setIsPersonalizationVisible(personalizationVisible !== 'false');
                    setIsWeeklyHighlightsVisible(weeklyHighlightsVisible !== 'false');
                }
            } catch (error) {
                console.error('Error loading visibility state:', error);
            } finally {
                setIsInitialized(true);
            }
        };
        loadVisibility();
    }, []);

    // Сохраняем состояние видимости
    const saveVisibility = useCallback(async (key: string, visible: boolean) => {
        try {
            if (Platform.OS === 'web') {
                if (visible) {
                    sessionStorage.removeItem(key);
                } else {
                    sessionStorage.setItem(key, 'false');
                }
            } else {
                if (visible) {
                    await AsyncStorage.removeItem(key);
                } else {
                    await AsyncStorage.setItem(key, 'false');
                }
            }
        } catch (error) {
            console.error('Error saving visibility state:', error);
        }
    }, []);

    const handleTogglePersonalization = useCallback(() => {
        const newValue = !isPersonalizationVisible;
        setIsPersonalizationVisible(newValue);
        saveVisibility(PERSONALIZATION_VISIBLE_KEY, newValue);
    }, [isPersonalizationVisible, saveVisibility]);

    const handleToggleWeeklyHighlights = useCallback(() => {
        const newValue = !isWeeklyHighlightsVisible;
        setIsWeeklyHighlightsVisible(newValue);
        saveVisibility(WEEKLY_HIGHLIGHTS_VISIBLE_KEY, newValue);
    }, [isWeeklyHighlightsVisible, saveVisibility]);

    // стабильный canonical без промежуточных значений при навигации
    const canonical = useMemo(() => `${SITE}${pathname || ''}`, [SITE, pathname]);

    const title = 'Маршруты, идеи и вдохновение для путешествий | Metravel';
    const description =
        'Авторские маршруты, советы и впечатления от путешественников по всему миру. Присоединяйся к сообществу Metravel и вдохновляйся на новые открытия!';

    return (
        <>
            {isFocused && (
                <InstantSEO
                    headKey="travel-list"
                    title={title}
                    description={description}
                    canonical={canonical}
                    image={`${SITE}/og-preview.jpg`}
                    ogType="website"
                />
            )}
            <View style={styles.container}>
                <ListTravel 
                    onTogglePersonalization={handleTogglePersonalization}
                    onToggleWeeklyHighlights={handleToggleWeeklyHighlights}
                    isPersonalizationVisible={isPersonalizationVisible}
                    isWeeklyHighlightsVisible={isWeeklyHighlightsVisible}
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1,
        backgroundColor: '#f9fafb',
    },
});

export default memo(TravelScreen);
