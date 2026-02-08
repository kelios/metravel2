import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NewConversationPicker from '@/components/messages/NewConversationPicker';
import type { MessagingUser } from '@/api/messages';

const mockUsers: MessagingUser[] = [
    { id: 1, first_name: 'Иван', last_name: 'Петров', avatar: 'https://example.com/avatar1.jpg', user: 10 },
    { id: 2, first_name: 'Мария', last_name: 'Сидорова', avatar: null, user: 20 },
    { id: 3, first_name: 'Алексей', last_name: null, avatar: null, user: 30 },
];

const defaultProps = {
    users: mockUsers,
    loading: false,
    onSelectUser: jest.fn(),
    onClose: jest.fn(),
};

describe('NewConversationPicker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders header with title', () => {
        const { getByText } = render(<NewConversationPicker {...defaultProps} />);
        expect(getByText('Новый диалог')).toBeTruthy();
    });

    it('renders user list', () => {
        const { getByText } = render(<NewConversationPicker {...defaultProps} />);
        expect(getByText('Иван Петров')).toBeTruthy();
        expect(getByText('Мария Сидорова')).toBeTruthy();
        expect(getByText('Алексей')).toBeTruthy();
    });

    it('calls onSelectUser with correct userId when user pressed', () => {
        const onSelectUser = jest.fn();
        const { getByLabelText } = render(
            <NewConversationPicker {...defaultProps} onSelectUser={onSelectUser} />
        );
        fireEvent.press(getByLabelText('Написать Иван Петров'));
        expect(onSelectUser).toHaveBeenCalledWith(10);
    });

    it('calls onClose when back button pressed', () => {
        const onClose = jest.fn();
        const { getByLabelText } = render(
            <NewConversationPicker {...defaultProps} onClose={onClose} />
        );
        fireEvent.press(getByLabelText('Назад к списку диалогов'));
        expect(onClose).toHaveBeenCalled();
    });

    it('filters users by search query', () => {
        const { getByLabelText, queryByText } = render(
            <NewConversationPicker {...defaultProps} />
        );
        const searchInput = getByLabelText('Поиск пользователя');
        fireEvent.changeText(searchInput, 'Мария');
        expect(queryByText('Мария Сидорова')).toBeTruthy();
        expect(queryByText('Иван Петров')).toBeNull();
    });

    it('shows empty state when no users match search', () => {
        const { getByLabelText, getByText } = render(
            <NewConversationPicker {...defaultProps} />
        );
        fireEvent.changeText(getByLabelText('Поиск пользователя'), 'несуществующий');
        expect(getByText('Пользователи не найдены')).toBeTruthy();
    });

    it('shows empty state when no users available', () => {
        const { getByText } = render(
            <NewConversationPicker {...defaultProps} users={[]} />
        );
        expect(getByText('Нет доступных пользователей')).toBeTruthy();
    });

    it('clears search when X button pressed', () => {
        const { getByLabelText, getByText, queryByText } = render(
            <NewConversationPicker {...defaultProps} />
        );
        fireEvent.changeText(getByLabelText('Поиск пользователя'), 'Мария');
        expect(queryByText('Иван Петров')).toBeNull();
        fireEvent.press(getByLabelText('Очистить поиск'));
        expect(getByText('Иван Петров')).toBeTruthy();
    });
});
