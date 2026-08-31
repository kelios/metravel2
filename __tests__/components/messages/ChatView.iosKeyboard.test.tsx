import { act, render } from '@testing-library/react-native';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import type { Message } from '@/api/messages';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
    let removers: Record<string, jest.Mock>;

    beforeEach(() => {
        listeners = {};
        removers = {};
        jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: any, callback: any) => {
            listeners[event] = callback;
            const remove = jest.fn();
            removers[event] = remove;
            return { remove };
        }) as any);
        jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
        jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
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
        expect(composerStyle.paddingBottom).toBe(320 + DESIGN_TOKENS.spacing.xs);
    });

    it('restores the safe-area reserve when the keyboard hides', () => {
        const { getByTestId } = render(<ChatView {...defaultProps} />);

        act(() => {
            listeners.keyboardDidShow?.({ endCoordinates: { height: 320 } });
        });
        act(() => {
            listeners.keyboardDidHide?.();
            // iPad can continue emitting frame changes after it reports that an
            // undocked/floating keyboard no longer covers the bottom edge.
            listeners.keyboardDidChangeFrame?.({ endCoordinates: { height: 240 } });
        });

        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);
        expect(composerStyle.paddingBottom).toBe(
            SAFE_AREA_BOTTOM + DESIGN_TOKENS.spacing.sm,
        );
    });

    it('tracks a changed docked-keyboard frame without re-adding the safe-area', () => {
        jest.mocked(Keyboard.isVisible).mockReturnValue(true);
        const { getByTestId } = render(<ChatView {...defaultProps} />);

        act(() => {
            listeners.keyboardDidShow?.({ endCoordinates: { height: 320 } });
            listeners.keyboardDidChangeFrame?.({ endCoordinates: { height: 360 } });
        });

        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);
        expect(composerStyle.paddingBottom).toBe(360 + DESIGN_TOKENS.spacing.xs);
    });

    it('uses current keyboard metrics on mount and removes every listener on unmount', () => {
        jest.mocked(Keyboard.isVisible).mockReturnValue(true);
        jest.mocked(Keyboard.metrics).mockReturnValue({
            height: 280,
            screenX: 0,
            screenY: 564,
            width: 390,
        });
        const { getByTestId, unmount } = render(<ChatView {...defaultProps} />);

        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);
        expect(composerStyle.paddingBottom).toBe(280 + DESIGN_TOKENS.spacing.xs);

        unmount();
        expect(removers.keyboardDidShow).toHaveBeenCalledTimes(1);
        expect(removers.keyboardDidHide).toHaveBeenCalledTimes(1);
        expect(removers.keyboardDidChangeFrame).toHaveBeenCalledTimes(1);
    });
});
