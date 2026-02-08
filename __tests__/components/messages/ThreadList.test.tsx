import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ThreadList from '@/components/messages/ThreadList';
import type { MessageThread } from '@/api/messages';

const mockThreads: MessageThread[] = [
    {
        id: 1,
        participants: [1, 2],
        created_at: '2024-01-01T00:00:00Z',
        last_message_created_at: '2024-06-15T14:30:00Z',
        unread_count: 3,
        last_message_text: 'Привет! Как дела?',
    },
    {
        id: 2,
        participants: [1, 3],
        created_at: '2024-01-02T00:00:00Z',
        last_message_created_at: '2024-06-14T10:00:00Z',
        unread_count: 0,
        last_message_text: 'Спасибо за информацию',
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

    it('renders last message preview', () => {
        const { getByText } = render(<ThreadList {...defaultProps} />);
        expect(getByText('Привет! Как дела?')).toBeTruthy();
        expect(getByText('Спасибо за информацию')).toBeTruthy();
    });

    it('renders unread badge for threads with unread messages', () => {
        const { getByText } = render(<ThreadList {...defaultProps} />);
        expect(getByText('3')).toBeTruthy();
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

    it('includes unread count in accessibility label', () => {
        const { getByLabelText } = render(<ThreadList {...defaultProps} />);
        expect(getByLabelText('Диалог с Иван Петров, 3 непрочитанных')).toBeTruthy();
    });
});
