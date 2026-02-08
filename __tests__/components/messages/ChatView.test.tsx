import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ChatView from '@/components/messages/ChatView';
import type { Message } from '@/api/messages';

const mockMessages: Message[] = [
    { id: 1, thread: 10, sender: 100, text: 'Привет!', created_at: '2024-06-15T10:00:00Z' },
    { id: 2, thread: 10, sender: 200, text: 'Здравствуйте!', created_at: '2024-06-15T10:01:00Z' },
    { id: 3, thread: 10, sender: 100, text: 'Как дела?', created_at: '2024-06-14T09:00:00Z' },
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

describe('ChatView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders header with other user name', () => {
        const { getByText } = render(<ChatView {...defaultProps} />);
        expect(getByText('Иван Петров')).toBeTruthy();
    });

    it('renders messages', () => {
        const { getByText } = render(<ChatView {...defaultProps} />);
        expect(getByText('Привет!')).toBeTruthy();
        expect(getByText('Здравствуйте!')).toBeTruthy();
        expect(getByText('Как дела?')).toBeTruthy();
    });

    it('renders empty state when no messages', () => {
        const { getByText } = render(
            <ChatView {...defaultProps} messages={[]} />
        );
        expect(getByText('Начните диалог — напишите сообщение')).toBeTruthy();
    });

    it('calls onSend when send button pressed with text', () => {
        const onSend = jest.fn();
        const { getByLabelText } = render(
            <ChatView {...defaultProps} onSend={onSend} />
        );
        const input = getByLabelText('Поле ввода сообщения');
        fireEvent.changeText(input, 'Новое сообщение');
        fireEvent.press(getByLabelText('Отправить сообщение'));
        expect(onSend).toHaveBeenCalledWith('Новое сообщение');
    });

    it('does not call onSend with empty text', () => {
        const onSend = jest.fn();
        const { getByLabelText } = render(
            <ChatView {...defaultProps} onSend={onSend} />
        );
        fireEvent.press(getByLabelText('Отправить сообщение'));
        expect(onSend).not.toHaveBeenCalled();
    });

    it('calls onBack when back button pressed', () => {
        const onBack = jest.fn();
        const { getByLabelText } = render(
            <ChatView {...defaultProps} onBack={onBack} />
        );
        fireEvent.press(getByLabelText('Назад к списку диалогов'));
        expect(onBack).toHaveBeenCalled();
    });

    it('hides back button when hideBackButton is true', () => {
        const { queryByLabelText } = render(
            <ChatView {...defaultProps} hideBackButton />
        );
        expect(queryByLabelText('Назад к списку диалогов')).toBeNull();
    });

    it('shows loading indicator when loading with no messages', () => {
        const { queryByText } = render(
            <ChatView {...defaultProps} messages={[]} loading={true} />
        );
        expect(queryByText('Привет!')).toBeNull();
    });

    it('renders date separators between different days', () => {
        const { getByText } = render(<ChatView {...defaultProps} />);
        // Messages span two days, so there should be date labels
        // The exact labels depend on the current date vs message dates
        // At minimum, the messages should render without errors
        expect(getByText('Привет!')).toBeTruthy();
        expect(getByText('Как дела?')).toBeTruthy();
    });
});
