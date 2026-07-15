import { render, fireEvent } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import ThreadList from '@/components/messages/ThreadList';
import type { MessageThread } from '@/api/messages';

const mockThreads: MessageThread[] = [
    {
        id: 1,
        participants: [1, 2],
        created_at: '2024-01-01T00:00:00Z',
        last_message_created_at: '2024-06-15T14:30:00Z',
    },
    {
        id: 2,
        participants: [1, 3],
        created_at: '2024-01-02T00:00:00Z',
        last_message_created_at: '2024-06-14T10:00:00Z',
    },
];

const participantNames = new Map<number, string>([
    [2, 'Иван Петров'],
    [3, 'Мария Сидорова'],
]);

const participantAvatars = new Map<number, string | null>([
    [2, 'https://example.com/avatar1.jpg'],
    [3, null],
]);

const defaultProps = {
    threads: mockThreads,
    loading: false,
    error: null,
    currentUserId: '1',
    participantNames,
    participantAvatars,
    onSelectThread: jest.fn(),
    onRefresh: jest.fn(),
    showSearch: true,
};

describe('ThreadList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders thread list with participant names', () => {
        const { getByText } = render(<ThreadList {...defaultProps} />);
        expect(getByText('Иван Петров')).toBeTruthy();
        expect(getByText('Мария Сидорова')).toBeTruthy();
    });

    it('calls onSelectThread when thread is pressed', () => {
        const onSelectThread = jest.fn();
        const { getByText } = render(
            <ThreadList {...defaultProps} onSelectThread={onSelectThread} />
        );
        fireEvent.press(getByText('Иван Петров'));
        expect(onSelectThread).toHaveBeenCalledWith(mockThreads[0]);
    });

    it('shows loading indicator when loading with no threads', () => {
        const { queryByText } = render(
            <ThreadList {...defaultProps} threads={[]} loading={true} />
        );
        expect(queryByText('Иван Петров')).toBeNull();
    });

    it('shows error state with retry button', () => {
        const onRefresh = jest.fn();
        const { getByText, getByLabelText } = render(
            <ThreadList {...defaultProps} error="Ошибка загрузки" onRefresh={onRefresh} />
        );
        expect(getByText('Ошибка загрузки')).toBeTruthy();
        fireEvent.press(getByLabelText('Повторить'));
        expect(onRefresh).toHaveBeenCalled();
    });

    it('shows empty state when no threads', () => {
        const { getByText } = render(
            <ThreadList {...defaultProps} threads={[]} />
        );
        expect(getByText('Нет сообщений')).toBeTruthy();
    });

    it('shows new conversation button in empty state', () => {
        const onNewConversation = jest.fn();
        const { getByLabelText } = render(
            <ThreadList {...defaultProps} threads={[]} onNewConversation={onNewConversation} />
        );
        fireEvent.press(getByLabelText('Новый диалог'));
        expect(onNewConversation).toHaveBeenCalled();
    });

    it('filters threads by search query', () => {
        const { getByLabelText, queryByText } = render(
            <ThreadList {...defaultProps} />
        );
        const searchInput = getByLabelText('Поиск диалогов');
        fireEvent.changeText(searchInput, 'Мария');
        expect(queryByText('Мария Сидорова')).toBeTruthy();
        expect(queryByText('Иван Петров')).toBeNull();
    });

    it('includes participant name in accessibility label', () => {
        const { getByLabelText } = render(<ThreadList {...defaultProps} />);
        expect(getByLabelText('Диалог с Иван Петров')).toBeTruthy();
    });

    it('announces unread count and caps the visible badge at 99+', () => {
        const unreadThread: MessageThread = {
            ...mockThreads[0],
            unread_count: 150,
        };
        const { getByLabelText, getByText } = render(
            <ThreadList {...defaultProps} threads={[unreadThread]} />
        );

        expect(getByLabelText('Диалог с Иван Петров, 150 непрочитанных')).toBeTruthy();
        expect(getByText('99+')).toBeTruthy();
    });

    it('shows explicit delete button for a thread', () => {
        const { getByLabelText } = render(
            <ThreadList {...defaultProps} onDeleteThread={jest.fn()} />
        );

        expect(getByLabelText('Удалить диалог с Иван Петров')).toBeTruthy();
    });

    it('renders the web confirmation and confirms thread deletion', () => {
        const originalPlatform = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        const onDeleteThread = jest.fn();

        try {
            const { getByLabelText } = render(
                <ThreadList {...defaultProps} onDeleteThread={onDeleteThread} />
            );

            fireEvent.press(getByLabelText('Удалить диалог с Иван Петров'));
            fireEvent.press(getByLabelText('Подтвердить удаление диалога'));

            expect(onDeleteThread).toHaveBeenCalledWith(1);
        } finally {
            Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
        }
    });

    it('uses the native destructive confirmation before deleting a thread', () => {
        const originalPlatform = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        const onDeleteThread = jest.fn();
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

        try {
            const { getByLabelText } = render(
                <ThreadList {...defaultProps} onDeleteThread={onDeleteThread} />
            );

            fireEvent.press(getByLabelText('Удалить диалог с Иван Петров'));
            expect(onDeleteThread).not.toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalledWith(
                'Удалить диалог',
                'Вы уверены, что хотите удалить этот диалог?',
                expect.any(Array),
            );

            const buttons = alertSpy.mock.calls[0]?.[2];
            const destructiveButton = buttons?.find((button) => button.style === 'destructive');
            destructiveButton?.onPress?.();
            expect(onDeleteThread).toHaveBeenCalledWith(1);
        } finally {
            alertSpy.mockRestore();
            Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
        }
    });

    it('labels a persisted thread with no remaining peer as a deleted user', () => {
        const orphanedThread: MessageThread = {
            ...mockThreads[0],
            participants: [1],
        };
        const { getByText, queryByText } = render(
            <ThreadList
                {...defaultProps}
                threads={[orphanedThread]}
                participantNames={new Map()}
            />
        );

        expect(getByText('Удалённый пользователь')).toBeTruthy();
        expect(queryByText('Пользователь')).toBeNull();
    });

    // Regression (prod bug: list showed generic «Пользователь»): ThreadList has NO
    // way to resolve a name on its own — it relies entirely on participantNames.
    // The screen MUST populate that map for thread peers that are not in the
    // available-users list (it now merges resolved profiles). This test documents
    // the contract: a missing entry falls back to «Пользователь», so the gap is
    // never the component's to hide — it must be filled by the screen.
    it('falls back to «Пользователь» only when the name map lacks the peer', () => {
        const { getByText, queryByText } = render(
            <ThreadList
                {...defaultProps}
                threads={[mockThreads[0]]}
                participantNames={new Map()}
            />
        );
        expect(getByText('Пользователь')).toBeTruthy();
        expect(queryByText('Иван Петров')).toBeNull();

        // With the name provided (как теперь делает экран через mergedNames) — реальное имя.
        const { getByText: getByText2 } = render(
            <ThreadList {...defaultProps} threads={[mockThreads[0]]} />
        );
        expect(getByText2('Иван Петров')).toBeTruthy();
    });
});
