import { act, render } from '@testing-library/react-native';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import type { Message } from '@/api/messages';

const SAFE_AREA_BOTTOM = 34;

jest.mock('react-native-safe-area-context', () => {
    const React = require('react');
    const insetValue = { top: 0, right: 0, bottom: SAFE_AREA_BOTTOM, left: 0 };
    const mod = {
        __esModule: true,
        SafeAreaProvider: ({ children }: any) => children,
        SafeAreaView: ({ children }: any) => children,
        SafeAreaInsetsContext: React.createContext(insetValue),
        useSafeAreaInsets: () => insetValue,
    };
    return { ...mod, default: mod };
});

// IS_IOS/IS_WEB are module constants, so select iOS before requiring ChatView.
const originalOS = Platform.OS;
Platform.OS = 'ios';
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
    reserveBottomDock: false,
};

describe('ChatView composer vs iOS keyboard', () => {
    let listeners: Record<string, (event?: any) => void>;

    beforeEach(() => {
        listeners = {};
        jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: any, callback: any) => {
            listeners[event] = callback;
            return { remove: jest.fn() };
        }) as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(() => {
        Platform.OS = originalOS;
    });

    it('lifts the composer by the keyboard height without adding the safe-area twice', () => {
        const { getByTestId } = render(<ChatView {...defaultProps} />);

        act(() => {
            listeners.keyboardDidShow?.({ endCoordinates: { height: 320 } });
        });

        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);
        expect(composerStyle.paddingBottom).toBeGreaterThanOrEqual(320);
        expect(composerStyle.paddingBottom).toBeLessThan(320 + SAFE_AREA_BOTTOM);
    });

    it('restores the safe-area reserve when the keyboard hides', () => {
        const { getByTestId } = render(<ChatView {...defaultProps} />);

        act(() => {
            listeners.keyboardDidShow?.({ endCoordinates: { height: 320 } });
        });
        act(() => {
            listeners.keyboardDidHide?.();
        });

        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);
        expect(composerStyle.paddingBottom).toBeGreaterThanOrEqual(SAFE_AREA_BOTTOM);
        expect(composerStyle.paddingBottom).toBeLessThan(320);
    });
});
