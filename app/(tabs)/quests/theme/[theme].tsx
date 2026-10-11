import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Static `theme` segment takes precedence over the quest-detail city segment. */
export default function QuestThemeRedirect() {
    const { theme } = useLocalSearchParams<{ theme?: string | string[] }>();
    const value = typeof theme === 'string' ? theme : '';
    return <Redirect href={{ pathname: '/quests', params: { theme: value } }} />;
}
