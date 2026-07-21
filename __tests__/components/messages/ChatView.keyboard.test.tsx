import { act, render } from '@testing-library/react-native';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import type { Message } from '@/api/messages';

const NAV_BAR_INSET = 24;

jest.mock('react-native-safe-area-context', () => {
    const React = require('react');
    const insetValue = { top: 0, right: 0, bottom: 24, left: 0 };
    const mod = {
        __esModule: true,
        SafeAreaProvider: ({ children }: any) => children,
        SafeAreaView: ({ children }: any) => children,
        SafeAreaInsetsContext: React.createContext(insetValue),
        useSafeAreaInsets: () => insetValue,
    };
    return { ...mod, default: mod };
});

// IS_IOS/IS_WEB — модульные константы ChatView, вычисляемые при импорте,
// поэтому платформу подменяем до require (import-ы поднимаются выше).
const originalOS = Platform.OS;
Platform.OS = 'android';
const ChatView = require('@/components/messages/ChatView').default;

const mockMessages: Message[] = [
    { id: 1, thread: 10, sender: 100, text: 'Привет!', created_at: '2024-06-15T10:00:00Z' },
];

const defaultProps = {
    messages: mockMessages,
    loading: false,
    sending: false,
    currentUserId: '100',
    otherUserName: 'Иван Петров',
    otherUserAvatar: null as string | null,
    onSend: jest.fn(),
    onBack: jest.fn(),
};

describe('ChatView composer vs Android keyboard', () => {
    let listeners: Record<string, (e: any) => void>;

    beforeEach(() => {
        listeners = {};
        jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: any, cb: any) => {
            listeners[event] = cb;
            return { remove: jest.fn() };
        }) as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(() => {
        Platform.OS = originalOS;
    });

    // RN отдаёт высоту клавиатуры без nav-bar инсета (imeInsets.bottom -
    // systemBars.bottom), а под edge-to-edge корневая вьюха уходит под этот бар:
    // без добавления insets.bottom клавиатура наезжает на поле ввода и «Отправить».
    it('lifts the composer by the keyboard height plus the navigation-bar inset', () => {
        const { getByTestId } = render(<ChatView {...defaultProps} />);

        act(() => {
            listeners.keyboardDidShow?.({ endCoordinates: { height: 300 } });
        });

        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);
        expect(composerStyle.paddingBottom).toBeGreaterThanOrEqual(300 + NAV_BAR_INSET);
    });

    it('restores the dock reserve when the keyboard hides', () => {
        const { getByTestId } = render(<ChatView {...defaultProps} />);

        act(() => {
            listeners.keyboardDidShow?.({ endCoordinates: { height: 300 } });
        });
        act(() => {
            listeners.keyboardDidHide?.();
        });

        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);
        expect(composerStyle.paddingBottom).toBeLessThan(300);
        expect(composerStyle.paddingBottom).toBeGreaterThanOrEqual(56 + NAV_BAR_INSET);
    });
});
