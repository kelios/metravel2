import React from 'react';
import { render } from '@testing-library/react-native';
import QuestThemeRedirect from '@/app/(tabs)/quests/theme/[theme]';
import fs from 'fs';
let mockTheme: string | string[] = 'halloween';
const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
    useLocalSearchParams: () => ({ theme: mockTheme }),
    Redirect: (props: unknown) => { mockRedirect(props); return null; },
}));
it.each(['halloween', 'unknown', 'http://external.example', ['halloween', 'detective']])('redirects %s only to the catalog without importing quest detail', (theme) => {
    mockTheme = theme;
    mockRedirect.mockClear();
    render(<QuestThemeRedirect />);
    expect(mockRedirect).toHaveBeenCalledWith({ href: { pathname: '/quests', params: { theme: typeof theme === 'string' ? theme : '' } } });
    const source = fs.readFileSync('app/(tabs)/quests/theme/[theme].tsx', 'utf8');
    expect(source).not.toMatch(/useQuestBundle|questId|useQuestsApi/);
});
