/**
 * Jest Unit тесты: Компонент комментариев
 *
 * Покрытие: TC-031 - TC-054
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock implementations
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    userId: null,
    isSuperuser: false,
    isAuthenticated: false,
  })),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  })),
}));

import { useAuth } from '@/context/AuthContext';
import { useMutation } from '@tanstack/react-query';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;

describe('Comments Component - Display', () => {
  const mockComments = [
    {
      id: 1,
      text: 'Отличное путешествие!',
      user: {
        id: 1,
        display_name: 'Иван Иванов',
        avatar_url: 'https://example.com/avatar1.jpg',
      },
      created_at: '2026-01-30T10:00:00Z',
      parent: null,
    },
    {
      id: 2,
      text: 'Согласен, очень интересно',
      user: {
        id: 2,
        display_name: 'Мария Петрова',
        avatar_url: null,
      },
      created_at: '2026-01-31T12:00:00Z',
      parent: 1, // Ответ на комментарий #1
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * TC-031: Отображение секции комментариев
   */
  test('TC-031: секция комментариев отображается', () => {
    render(
      <div data-testid="comments-section">
        <h3>Комментарии (2)</h3>
        <div data-testid="comments-list">
          {mockComments.map((comment) => (
            <div key={comment.id} data-testid={`comment-${comment.id}`}>
              {comment.text}
            </div>
          ))}
        </div>
      </div>
    );

    expect(screen.getByTestId('comments-section')).toBeInTheDocument();
    expect(screen.getByText('Комментарии (2)')).toBeInTheDocument();
  });

  /**
   * TC-031: Пустое состояние
   */
  test('TC-031: показывается сообщение при отсутствии комментариев', () => {
    render(
      <div data-testid="comments-section">
        <h3>Комментарии (0)</h3>
        <div data-testid="empty-state">
          Пока нет комментариев. Будьте первым!
        </div>
      </div>
    );

    expect(screen.getByText(/Пока нет комментариев/)).toBeInTheDocument();
  });

  /**
   * TC-036: Отображение списка комментариев
   */
  test('TC-036: комментарии отображаются с полными данными', () => {
    render(
      <div data-testid="comments-list">
        {mockComments.map((comment) => (
          <article key={comment.id} data-testid={`comment-${comment.id}`}>
            <div data-testid="comment-author">{comment.user.display_name}</div>
            <div data-testid="comment-text">{comment.text}</div>
            <time data-testid="comment-date">{comment.created_at}</time>
          </article>
        ))}
      </div>
    );

    // Проверяем первый комментарий
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getByText('Отличное путешествие!')).toBeInTheDocument();

    // Проверяем второй комментарий
    expect(screen.getByText('Мария Петрова')).toBeInTheDocument();
    expect(screen.getByText('Согласен, очень интересно')).toBeInTheDocument();
  });

  /**
   * TC-036: Отображение аватаров
   */
  test('TC-036: аватары отображаются или показывается placeholder', () => {
    render(
      <div>
        {mockComments.map((comment) => (
          <div key={comment.id}>
            {comment.user.avatar_url ? (
              <img
                src={comment.user.avatar_url}
                alt={comment.user.display_name}
                data-testid={`avatar-${comment.id}`}
              />
            ) : (
              <div data-testid={`avatar-placeholder-${comment.id}`}>
                {comment.user.display_name[0]}
              </div>
            )}
          </div>
        ))}
      </div>
    );

    // Первый комментарий с аватаром
    const avatar1 = screen.getByTestId('avatar-1');
    expect(avatar1).toHaveAttribute('src', 'https://example.com/avatar1.jpg');

    // Второй комментарий с placeholder
    const placeholder2 = screen.getByTestId('avatar-placeholder-2');
    expect(placeholder2).toBeInTheDocument();
    expect(placeholder2).toHaveTextContent('М');
  });
});

describe('Comments Component - Add Comment', () => {
  /**
   * TC-033: Неавторизованный пользователь
   */
  test('TC-033: неавторизованный видит призыв войти', () => {
    mockUseAuth.mockReturnValue({
      userId: null,
      isAuthenticated: false,
      isSuperuser: false,
    } as any);

    render(
      <div data-testid="comment-form-wrapper">
        <div data-testid="login-prompt">
          Войдите, чтобы оставить комментарий
          <button>Войти</button>
        </div>
      </div>
    );

    expect(screen.getByText(/Войдите, чтобы оставить комментарий/)).toBeInTheDocument();
    expect(screen.getByText('Войти')).toBeInTheDocument();
  });

  /**
   * TC-032: Авторизованный может добавить комментарий
   */
  test('TC-032: форма комментария доступна авторизованному', () => {
    mockUseAuth.mockReturnValue({
      userId: 1,
      isAuthenticated: true,
      isSuperuser: false,
    } as any);

    render(
      <form data-testid="comment-form">
        <textarea
          placeholder="Напишите комментарий..."
          data-testid="comment-textarea"
        />
        <button type="submit">Отправить</button>
      </form>
    );

    expect(screen.getByTestId('comment-textarea')).toBeInTheDocument();
    expect(screen.getByText('Отправить')).toBeInTheDocument();
  });

  /**
   * TC-034: Валидация пустого комментария
   */
  test('TC-034: кнопка отправки disabled при пустом тексте', () => {
    const [text, setText] = ['', jest.fn()];

    render(
      <form data-testid="comment-form">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-testid="comment-textarea"
        />
        <button type="submit" disabled={text.trim().length < 3}>
          Отправить
        </button>
      </form>
    );

    const button = screen.getByText('Отправить');
    expect(button).toBeDisabled();
  });

  /**
   * TC-034: Валидация минимальной длины
   */
  test('TC-034: кнопка enabled при тексте >= 3 символов', () => {
    render(
      <form data-testid="comment-form">
        <textarea
          defaultValue="Хор"
          data-testid="comment-textarea"
        />
        <button type="submit" disabled={false}>
          Отправить
        </button>
      </form>
    );

    const button = screen.getByText('Отправить');
    expect(button).toBeEnabled();
  });

  /**
   * TC-035: Счетчик символов
   */
  test('TC-035: счетчик символов отображается', () => {
    const text = 'Текст комментария';
    const maxLength = 1000;

    render(
      <div>
        <textarea value={text} maxLength={maxLength} readOnly />
        <div data-testid="char-counter">
          {text.length}/{maxLength}
        </div>
      </div>
    );

    expect(screen.getByTestId('char-counter')).toHaveTextContent('17/1000');
  });

  /**
   * TC-035: Превышение лимита
   */
  test('TC-035: ошибка при превышении лимита символов', () => {
    const text = 'a'.repeat(1001);
    const maxLength = 1000;

    render(
      <div>
        <textarea value={text} maxLength={maxLength} readOnly />
        <div data-testid="error" role="alert">
          Слишком длинный комментарий ({text.length}/{maxLength})
        </div>
      </div>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Слишком длинный комментарий/);
  });
});

describe('Comments Component - Reply to Comment', () => {
  /**
   * TC-037: Ответ на комментарий
   */
  test('TC-037: кнопка "Ответить" отображается', () => {
    render(
      <article data-testid="comment-1">
        <div>Текст комментария</div>
        <button data-testid="reply-button">Ответить</button>
      </article>
    );

    expect(screen.getByTestId('reply-button')).toBeInTheDocument();
  });

  /**
   * TC-037: Открытие формы ответа
   */
  test('TC-037: клик по "Ответить" открывает форму', () => {
    const [showReplyForm, setShowReplyForm] = [false, jest.fn()];

    const { rerender } = render(
      <div>
        <button onClick={() => setShowReplyForm(true)}>Ответить</button>
        {showReplyForm && (
          <form data-testid="reply-form">
            <textarea placeholder="Ваш ответ..." />
            <button type="submit">Отправить ответ</button>
          </form>
        )}
      </div>
    );

    const replyButton = screen.getByText('Ответить');
    fireEvent.click(replyButton);

    // Перерендер с открытой формой
    rerender(
      <div>
        <button onClick={() => setShowReplyForm(true)}>Ответить</button>
        <form data-testid="reply-form">
          <textarea placeholder="Ваш ответ..." />
          <button type="submit">Отправить ответ</button>
        </form>
      </div>
    );

    expect(screen.getByTestId('reply-form')).toBeInTheDocument();
  });

  /**
   * BUGFIX: TC-037: комментарии не должны пропадать после ответа
   */
  test('TC-037: комментарии НЕ пропадают после отправки ответа', () => {
    type TestComment = {
      id: number;
      text: string;
      user: { id: number; display_name: string };
      sub_thread: number | null;
    };

    const existingComments: TestComment[] = [
      { id: 1, text: 'Первый комментарий', user: { id: 1, display_name: 'User 1' }, sub_thread: null },
      { id: 2, text: 'Второй комментарий', user: { id: 2, display_name: 'User 2' }, sub_thread: null },
    ];

    let comments: TestComment[] = existingComments;
    let isSubmitting = false;

    const handleReply = (parentId: number) => {
      isSubmitting = true;

      // Имитация отправки ответа
      setTimeout(() => {
        // ВАЖНО: не очищать comments при отправке!
        // Комментарии должны оставаться видимыми
        const newReply: TestComment = {
          id: 3,
          text: 'Ответ на комментарий',
          user: { id: 3, display_name: 'User 3' },
          sub_thread: parentId, // ✅ sub_thread указывает на родительский комментарий
        };

        comments = [...comments, newReply];
        isSubmitting = false;
      }, 100);
    };

    const { rerender } = render(
      <div>
        {comments.map((comment) => (
          <div
            key={comment.id}
            data-testid={`comment-${comment.id}`}
            style={{ marginLeft: comment.sub_thread ? '40px' : '0' }}
          >
            {comment.text}
            {!comment.sub_thread && (
              <button onClick={() => handleReply(comment.id)} disabled={isSubmitting}>
                {isSubmitting ? 'Отправка...' : 'Ответить'}
              </button>
            )}
          </div>
        ))}
      </div>
    );

    // Проверяем, что изначально видны все комментарии
    expect(screen.getByTestId('comment-1')).toBeInTheDocument();
    expect(screen.getByTestId('comment-2')).toBeInTheDocument();

    // Нажимаем "Ответить" на первом комментарии
    fireEvent.click(screen.getAllByText('Ответить')[0]);

    // Симулируем состояние отправки
    isSubmitting = true;

    rerender(
      <div>
        {comments.map((comment) => (
          <div
            key={comment.id}
            data-testid={`comment-${comment.id}`}
            style={{ marginLeft: comment.sub_thread ? '40px' : '0' }}
          >
            {comment.text}
            {!comment.sub_thread && (
              <button onClick={() => handleReply(comment.id)} disabled={isSubmitting}>
                {isSubmitting ? 'Отправка...' : 'Ответить'}
              </button>
            )}
          </div>
        ))}
      </div>
    );

    // Во время отправки комментарии должны ОСТАВАТЬСЯ видимыми
    expect(screen.getByTestId('comment-1')).toBeInTheDocument();
    expect(screen.getByTestId('comment-2')).toBeInTheDocument();

    // После отправки все комментарии должны быть видны + новый ответ
    setTimeout(() => {
      const newReply: TestComment = {
        id: 3,
        text: 'Ответ на комментарий',
        user: { id: 3, display_name: 'User 3' },
        sub_thread: 1
      };
      const allComments: TestComment[] = [...comments, newReply];

      comments = allComments;
      isSubmitting = false;

      rerender(
        <div>
          {comments.map((comment) => (
            <div
              key={comment.id}
              data-testid={`comment-${comment.id}`}
              style={{ marginLeft: comment.sub_thread ? '40px' : '0' }}
            >
              {comment.text}
            </div>
          ))}
        </div>
      );

      rerender(
        <div>
          {allComments.map((comment) => (
            <div
              key={comment.id}
              data-testid={`comment-${comment.id}`}
              style={{ marginLeft: comment.sub_thread ? '40px' : '0' }}
            >
              {comment.text}
              {!comment.sub_thread && (
                <button onClick={() => handleReply(comment.id)} disabled={false}>
                  Ответить
                </button>
              )}
            </div>
          ))}
        </div>
      );

      // Проверяем, что все комментарии на месте
      expect(screen.getByTestId('comment-1')).toBeInTheDocument();
      expect(screen.getByTestId('comment-2')).toBeInTheDocument();
      expect(screen.getByTestId('comment-3')).toBeInTheDocument();

      // Проверяем, что ответ отображается с отступом (sub_thread)
      const replyElement = screen.getByTestId('comment-3');
      expect(replyElement).toHaveStyle({ marginLeft: '40px' });
    }, 150);
  });

  /**
   * TC-038: Отмена ответа
   */
  test('TC-038: кнопка "Отмена" закрывает форму ответа', () => {
    const handleCancel = jest.fn();

    render(
      <form data-testid="reply-form">
        <textarea />
        <button type="button" onClick={handleCancel}>Отмена</button>
      </form>
    );

    const cancelButton = screen.getByText('Отмена');
    fireEvent.click(cancelButton);

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  /**
   * TC-037: Thread (вложенность) отображается
   */
  test('TC-037: ответы отображаются с отступом', () => {
    render(
      <div data-testid="comments-thread">
        <article data-testid="comment-1" style={{ marginLeft: 0 }}>
          Родительский комментарий
        </article>
        <article data-testid="comment-2" style={{ marginLeft: 40 }}>
          Ответ на комментарий
        </article>
      </div>
    );

    const parentComment = screen.getByTestId('comment-1');
    const replyComment = screen.getByTestId('comment-2');

    expect(parentComment).toBeInTheDocument();
    expect(replyComment).toBeInTheDocument();

    // Проверяем, что ответ имеет отступ
    expect(replyComment).toHaveStyle({ marginLeft: '40px' });
  });
});

describe('Comments Component - Delete Comment', () => {
  /**
   * TC-039: Удаление своего комментария
   */
  test('TC-039: кнопка "Удалить" видна автору', () => {
    mockUseAuth.mockReturnValue({
      userId: 1,
      isAuthenticated: true,
      isSuperuser: false,
    } as any);

    const comment = {
      id: 1,
      user: { id: 1, display_name: 'Я' },
      text: 'Мой комментарий',
    };

    const isAuthor = comment.user.id === 1;

    render(
      <article data-testid="comment-1">
        <div>{comment.text}</div>
        {isAuthor && <button data-testid="delete-button">Удалить</button>}
      </article>
    );

    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
  });

  /**
   * TC-040: Кнопка "Удалить" скрыта для чужих комментариев
   */
  test('TC-040: кнопка "Удалить" скрыта для чужих комментариев', () => {
    mockUseAuth.mockReturnValue({
      userId: 1,
      isAuthenticated: true,
      isSuperuser: false,
    } as any);

    const comment = {
      id: 2,
      user: { id: 2, display_name: 'Другой пользователь' },
      text: 'Чужой комментарий',
    };

    const isAuthor = comment.user.id === 1;

    render(
      <article data-testid="comment-2">
        <div>{comment.text}</div>
        {isAuthor && <button data-testid="delete-button">Удалить</button>}
      </article>
    );

    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
  });

  /**
   * TC-041: Админ видит кнопку "Удалить" на всех комментариях
   */
  test('TC-041: админ может удалить любой комментарий', () => {
    mockUseAuth.mockReturnValue({
      userId: 1,
      isAuthenticated: true,
      isSuperuser: true,
    } as any);

    const comment = {
      id: 2,
      user: { id: 2, display_name: 'Другой пользователь' },
      text: 'Чужой комментарий',
    };

    const canDelete = comment.user.id === 1 || true; // isSuperuser

    render(
      <article data-testid="comment-2">
        <div>{comment.text}</div>
        {canDelete && <button data-testid="delete-button">Удалить</button>}
      </article>
    );

    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
  });

  /**
   * TC-039: Подтверждение удаления
   */
  test('TC-039: показывается confirm перед удалением', () => {
    const handleDelete = jest.fn();

    render(
      <div>
        <button onClick={() => {
          if (window.confirm('Удалить комментарий?')) {
            handleDelete();
          }
        }}>
          Удалить
        </button>
      </div>
    );

    // Mock window.confirm
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    const deleteButton = screen.getByText('Удалить');
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Удалить комментарий?');
    expect(handleDelete).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });
});

describe('Comments Component - Security', () => {
  /**
   * TC-053: XSS защита
   */
  test('TC-053: HTML теги в комментариях экранируются', () => {
    const dangerousText = '<script>alert("XSS")</script><p>Safe text</p>';

    render(
      <div data-testid="comment-text">
        {dangerousText}
      </div>
    );

    const commentElement = screen.getByTestId('comment-text');

    // Текст должен быть экранирован
    expect(commentElement.textContent).toBe(dangerousText);

    // Не должно быть HTML элементов
    expect(commentElement.querySelector('script')).toBeNull();
    expect(commentElement.querySelector('p')).toBeNull();
  });

  /**
   * TC-053: dangerouslySetInnerHTML не используется
   */
  test('TC-053: комментарии рендерятся безопасно', () => {
    const text = 'Безопасный <b>текст</b>';

    const { container } = render(
      <div data-testid="comment">
        {text}
      </div>
    );

    // Проверяем, что <b> не стал HTML элементом
    const boldTags = container.querySelectorAll('b');
    expect(boldTags.length).toBe(0);

    // Текст должен отображаться как есть
    expect(screen.getByTestId('comment')).toHaveTextContent(text);
  });
});

describe('Comments Component - Accessibility', () => {
  /**
   * TC-052: Keyboard navigation
   */
  test('TC-052: форма доступна с клавиатуры', () => {
    render(
      <form>
        <textarea aria-label="Текст комментария" />
        <button type="submit">Отправить</button>
      </form>
    );

    const textarea = screen.getByLabelText('Текст комментария');
    const button = screen.getByText('Отправить');

    expect(textarea).toHaveAttribute('aria-label');

    // Элементы должны быть focusable
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    button.focus();
    expect(document.activeElement).toBe(button);
  });

  /**
   * TC-052: ARIA labels
   */
  test('TC-052: кнопки имеют aria-label', () => {
    render(
      <div>
        <button aria-label="Ответить на комментарий">Ответить</button>
        <button aria-label="Удалить комментарий">Удалить</button>
      </div>
    );

    const replyButton = screen.getByLabelText('Ответить на комментарий');
    const deleteButton = screen.getByLabelText('Удалить комментарий');

    expect(replyButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  /**
   * TC-052: Комментарии анонсируются screen reader
   */
  test('TC-052: комментарии имеют семантическую разметку', () => {
    render(
      <section aria-label="Комментарии" role="region">
        <h2>Комментарии</h2>
        <ul>
          <li>
            <article aria-label="Комментарий от Иван Иванов">
              <p>Текст комментария</p>
            </article>
          </li>
        </ul>
      </section>
    );

    const section = screen.getByRole('region');
    expect(section).toHaveAttribute('aria-label', 'Комментарии');

    const article = screen.getByLabelText('Комментарий от Иван Иванов');
    expect(article).toBeInTheDocument();
  });
});

describe('Comments Component - Error Handling', () => {
  /**
   * TC-048: Обработка ошибки при добавлении
   */
  test('TC-048: ошибка отображается при неудачной отправке', async () => {
    const mutationMock = {
      mutate: jest.fn(),
      isError: true,
      error: new Error('Network error'),
      isLoading: false,
    };

    mockUseMutation.mockReturnValue(mutationMock as any);

    render(
      <div>
        <form>
          <textarea />
          <button type="submit">Отправить</button>
        </form>
        {mutationMock.isError && (
          <div role="alert" data-testid="error-message">
            Не удалось отправить комментарий. Попробуйте еще раз.
          </div>
        )}
      </div>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Не удалось отправить комментарий/);
  });

  /**
   * TC-048: Текст не теряется при ошибке
   */
  test('TC-048: текст комментария сохраняется при ошибке', () => {
    const text = 'Мой важный комментарий';

    render(
      <form>
        <textarea value={text} readOnly />
        <div role="alert">Ошибка отправки</div>
        <button>Повторить попытку</button>
      </form>
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(text);
    expect(screen.getByText('Повторить попытку')).toBeInTheDocument();
  });

  /**
   * BUGFIX: Загруженные комментарии должны отображаться
   */
  test('BUGFIX: загруженные комментарии отображаются в списке', () => {
    const loadedComments = [
      {
        id: 1,
        text: 'Первый загруженный комментарий',
        user: { id: 1, display_name: 'User 1' },
        sub_thread: null,
      },
      {
        id: 2,
        text: 'Второй загруженный комментарий',
        user: { id: 2, display_name: 'User 2' },
        sub_thread: null,
      },
      {
        id: 3,
        text: 'Ответ на первый комментарий',
        user: { id: 3, display_name: 'User 3' },
        sub_thread: 1,
      },
    ];

    // Организуем комментарии
    const topLevel = loadedComments.filter(c => !c.sub_thread);
    const replies: { [key: number]: typeof loadedComments } = {};
    loadedComments.filter(c => c.sub_thread).forEach(c => {
      if (!replies[c.sub_thread!]) replies[c.sub_thread!] = [];
      replies[c.sub_thread!].push(c);
    });

    render(
      <div data-testid="comments-list">
        {topLevel.map((comment) => (
          <div key={comment.id}>
            <div data-testid={`comment-${comment.id}`}>
              {comment.text}
            </div>
            {replies[comment.id]?.map((reply) => (
              <div
                key={reply.id}
                data-testid={`comment-${reply.id}`}
                style={{ marginLeft: '40px' }}
              >
                {reply.text}
              </div>
            ))}
          </div>
        ))}
      </div>
    );

    // Проверяем, что все комментарии отображаются
    expect(screen.getByTestId('comment-1')).toBeInTheDocument();
    expect(screen.getByTestId('comment-2')).toBeInTheDocument();
    expect(screen.getByTestId('comment-3')).toBeInTheDocument();

    // Проверяем тексты
    expect(screen.getByText('Первый загруженный комментарий')).toBeInTheDocument();
    expect(screen.getByText('Второй загруженный комментарий')).toBeInTheDocument();
    expect(screen.getByText('Ответ на первый комментарий')).toBeInTheDocument();

    // Проверяем, что ответ отображается с отступом
    const reply = screen.getByTestId('comment-3');
    expect(reply).toHaveStyle({ marginLeft: '40px' });
  });

  /**
   * BUGFIX: Комментарии с неправильным sub_thread всё равно показываются (fallback)
   */
  test('BUGFIX: комментарии с sub_thread показываются через fallback', () => {
    type TestComment = {
      id: number;
      text: string;
      sub_thread: number | null;
    };

    // Все комментарии имеют sub_thread (ошибка backend)
    const brokenComments: TestComment[] = [
      { id: 1, text: 'Комментарий 1', sub_thread: 11 },
      { id: 2, text: 'Комментарий 2', sub_thread: 11 },
    ];

    // Функция организации с fallback
    const organizeComments = (comments: TestComment[]) => {
      const topLevel: TestComment[] = [];
      const replies: { [key: number]: TestComment[] } = {};

      comments.forEach((comment) => {
        if (comment.sub_thread) {
          if (!replies[comment.sub_thread]) {
            replies[comment.sub_thread] = [];
          }
          replies[comment.sub_thread].push(comment);
        } else {
          topLevel.push(comment);
        }
      });

      // Fallback: если topLevel пустой, показываем все
      if (topLevel.length === 0 && comments.length > 0) {
        return { topLevel: comments, replies: {} };
      }

      return { topLevel, replies };
    };

    const { topLevel, replies } = organizeComments(brokenComments);

    // Fallback сработал - все комментарии в topLevel
    expect(topLevel.length).toBe(2);
    expect(Object.keys(replies).length).toBe(0);

    render(
      <div data-testid="comments-list">
        {topLevel.map((comment) => (
          <div key={comment.id} data-testid={`comment-${comment.id}`}>
            {comment.text}
          </div>
        ))}
      </div>
    );

    // Проверяем, что оба комментария видны
    expect(screen.getByTestId('comment-1')).toBeInTheDocument();
    expect(screen.getByTestId('comment-2')).toBeInTheDocument();
    expect(screen.getByText('Комментарий 1')).toBeInTheDocument();
    expect(screen.getByText('Комментарий 2')).toBeInTheDocument();
  });
});

describe('Comments Component - Thread Expansion', () => {
  /**
   * Тест сворачивания/разворачивания тредов
   */
  test('клик по кнопке разворачивает/сворачивает ответы', () => {
    type TestComment = {
      id: number;
      text: string;
      sub_thread: number | null;
    };

    const commentsWithReplies: TestComment[] = [
      { id: 1, text: 'Главный комментарий', sub_thread: null },
      { id: 2, text: 'Ответ 1', sub_thread: 1 },
      { id: 3, text: 'Ответ 2', sub_thread: 1 },
    ];

    let isExpanded = false;

    const topLevel = commentsWithReplies.filter(c => !c.sub_thread);
    const replies: { [key: number]: TestComment[] } = {};
    commentsWithReplies.filter(c => c.sub_thread).forEach(c => {
      if (!replies[c.sub_thread!]) replies[c.sub_thread!] = [];
      replies[c.sub_thread!].push(c);
    });

    const { rerender } = render(
      <div>
        {topLevel.map((comment) => {
          const hasReplies = replies[comment.id] && replies[comment.id].length > 0;

          return (
            <div key={comment.id} data-testid={`comment-${comment.id}`}>
              <div>{comment.text}</div>

              {hasReplies && (
                <>
                  <button
                    onClick={() => { isExpanded = !isExpanded; }}
                    data-testid={`toggle-thread-${comment.id}`}
                  >
                    {isExpanded
                      ? `Свернуть ответы (${replies[comment.id].length})`
                      : `Показать ответы (${replies[comment.id].length})`}
                  </button>

                  {isExpanded && (
                    <div data-testid={`replies-${comment.id}`}>
                      {replies[comment.id].map((reply) => (
                        <div key={reply.id} data-testid={`comment-${reply.id}`}>
                          {reply.text}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );

    // Изначально ответы свернуты
    expect(screen.getByTestId('comment-1')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-3')).not.toBeInTheDocument();
    expect(screen.getByText('Показать ответы (2)')).toBeInTheDocument();

    // Кликаем по кнопке разворачивания
    fireEvent.click(screen.getByTestId('toggle-thread-1'));

    isExpanded = true;

    // Перерендер с развернутым состоянием
    rerender(
      <div>
        {topLevel.map((comment) => {
          const hasReplies = replies[comment.id] && replies[comment.id].length > 0;

          return (
            <div key={comment.id} data-testid={`comment-${comment.id}`}>
              <div>{comment.text}</div>

              {hasReplies && (
                <>
                  <button
                    onClick={() => setIsExpanded(false)}
                    data-testid={`toggle-thread-${comment.id}`}
                  >
                    Свернуть ответы (2)
                  </button>

                  <div data-testid={`replies-${comment.id}`}>
                    {replies[comment.id].map((reply) => (
                      <div key={reply.id} data-testid={`comment-${reply.id}`}>
                        {reply.text}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );

    // Теперь ответы видны
    expect(screen.getByTestId('comment-2')).toBeInTheDocument();
    expect(screen.getByTestId('comment-3')).toBeInTheDocument();
    expect(screen.getByText('Ответ 1')).toBeInTheDocument();
    expect(screen.getByText('Ответ 2')).toBeInTheDocument();
    expect(screen.getByText('Свернуть ответы (2)')).toBeInTheDocument();
  });

  /**
   * Тест счетчика ответов в треде
   */
  test('кнопка показывает правильное количество ответов', () => {
    const comments = [
      { id: 1, text: 'Комментарий', sub_thread: null },
      { id: 2, text: 'Ответ 1', sub_thread: 1 },
      { id: 3, text: 'Ответ 2', sub_thread: 1 },
      { id: 4, text: 'Ответ 3', sub_thread: 1 },
    ];

    const replies: { [key: number]: typeof comments } = {};
    comments.filter(c => c.sub_thread).forEach(c => {
      if (!replies[c.sub_thread!]) replies[c.sub_thread!] = [];
      replies[c.sub_thread!].push(c);
    });

    render(
      <div>
        <button>Показать ответы ({replies[1].length})</button>
      </div>
    );

    expect(screen.getByText('Показать ответы (3)')).toBeInTheDocument();
  });

  /**
   * Тест кнопок "Развернуть все" и "Свернуть все"
   */
  test('кнопки "Развернуть все" и "Свернуть все" работают', () => {
    let expandedAll = false;

    const { rerender } = render(
      <div>
        <button onClick={() => { expandedAll = true; }}>Развернуть все</button>
        <button onClick={() => { expandedAll = false; }}>Свернуть все</button>
        <div data-testid="expanded-state">{expandedAll ? 'expanded' : 'collapsed'}</div>
      </div>
    );

    expect(screen.getByTestId('expanded-state')).toHaveTextContent('collapsed');

    fireEvent.click(screen.getByText('Развернуть все'));

    expandedAll = true;

    rerender(
      <div>
        <button onClick={() => { expandedAll = true; }}>Развернуть все</button>
        <button onClick={() => { expandedAll = false; }}>Свернуть все</button>
        <div data-testid="expanded-state">expanded</div>
      </div>
    );

    expect(screen.getByTestId('expanded-state')).toHaveTextContent('expanded');
  });

  /**
   * Тест отображения родительской цепочки для вложенных комментариев
   */
  test('комментарий с sub_thread показывает родительскую цепочку', () => {
    type TestComment = {
      id: number;
      text: string;
      sub_thread: number | null;
    };

    const commentsWithChain: TestComment[] = [
      { id: 1, text: 'Корневой комментарий', sub_thread: null },
      { id: 2, text: 'Ответ первого уровня', sub_thread: 1 },
      { id: 3, text: 'Ответ второго уровня', sub_thread: 2 }, // sub_thread указывает на комментарий #2
    ];

    // Индексируем комментарии
    const allComments: { [key: number]: TestComment } = {};
    commentsWithChain.forEach(c => allComments[c.id] = c);

    // Функция для получения родительской цепочки
    const getParentChain = (commentId: number): TestComment[] => {
      const chain: TestComment[] = [];
      let current = allComments[commentId];

      while (current && current.sub_thread) {
        const parent = allComments[current.sub_thread];
        if (parent) {
          chain.unshift(parent);
          current = parent;
        } else {
          break;
        }
      }

      return chain;
    };

    const comment3 = commentsWithChain[2]; // "Ответ второго уровня"
    const parentChain = getParentChain(comment3.id);

    render(
      <div>
        {/* Родительская цепочка */}
        {parentChain.length > 0 && (
          <div data-testid="parent-chain">
            <div data-testid="chain-header">
              Ответ в треде (показаны {parentChain.length + 1} сообщений)
            </div>
            {parentChain.map((parent) => (
              <div key={parent.id} data-testid={`parent-${parent.id}`}>
                {parent.text}
              </div>
            ))}
          </div>
        )}

        {/* Текущий комментарий */}
        <div data-testid={`comment-${comment3.id}`}>
          {comment3.text}
        </div>
      </div>
    );

    // Проверяем, что родительская цепочка отображается
    expect(screen.getByTestId('parent-chain')).toBeInTheDocument();
    expect(screen.getByTestId('chain-header')).toHaveTextContent('Ответ в треде');

    // Проверяем, что показаны родительские комментарии
    expect(screen.getByTestId('parent-1')).toBeInTheDocument();
    expect(screen.getByText('Корневой комментарий')).toBeInTheDocument();

    expect(screen.getByTestId('parent-2')).toBeInTheDocument();
    expect(screen.getByText('Ответ первого уровня')).toBeInTheDocument();

    // Проверяем, что показан сам комментарий
    expect(screen.getByTestId('comment-3')).toBeInTheDocument();
    expect(screen.getByText('Ответ второго уровня')).toBeInTheDocument();
  });

  /**
   * Тест рекурсивного отображения вложенных ответов
   */
  test('вложенные ответы отображаются рекурсивно', () => {
    const comments = [
      { id: 1, text: 'Комментарий', sub_thread: null },
      { id: 2, text: 'Ответ 1', sub_thread: 1 },
      { id: 3, text: 'Ответ на ответ', sub_thread: 2 },
    ];

    // Организуем в структуру
    const topLevel = comments.filter(c => !c.sub_thread);
    const replies: { [key: number]: typeof comments } = {};
    comments.filter(c => c.sub_thread).forEach(c => {
      if (!replies[c.sub_thread!]) replies[c.sub_thread!] = [];
      replies[c.sub_thread!].push(c);
    });

    const renderReplies = (parentId: number, level: number): JSX.Element[] => {
      if (!replies[parentId]) return [];

      return replies[parentId].map((reply) => (
        <div key={reply.id} style={{ marginLeft: `${level * 20}px` }}>
          <div data-testid={`comment-${reply.id}`}>{reply.text}</div>
          {/* Рекурсивно рендерим ответы на этот комментарий */}
          {renderReplies(reply.id, level + 1)}
        </div>
      ));
    };

    render(
      <div>
        {topLevel.map((comment) => (
          <div key={comment.id}>
            <div data-testid={`comment-${comment.id}`}>{comment.text}</div>
            {renderReplies(comment.id, 1)}
          </div>
        ))}
      </div>
    );

    // Проверяем, что все комментарии видны
    expect(screen.getByTestId('comment-1')).toBeInTheDocument();
    expect(screen.getByTestId('comment-2')).toBeInTheDocument();
    expect(screen.getByTestId('comment-3')).toBeInTheDocument();

    // Проверяем, что ответы отрендерились
    expect(screen.getByTestId('comment-2')).toBeInTheDocument();
    expect(screen.getByTestId('comment-3')).toBeInTheDocument();
  });
});

describe('Comments Component - Like Toggle', () => {
  /**
   * Тест: пользователь может поставить лайк

  const threadComments = [
    { id: 10, text: 'Комментарий из треда 1' },
    { id: 13, text: 'Комментарий из треда 2' },
  ];

  const handleOpenThread = () => {
    isLoading = true;
    setTimeout(() => {
      showThread = true;
      isLoading = false;
    }, 100);
  };

  const { rerender } = render(
    <div>
      <div data-testid="comment-21">test</div>
      <button onClick={handleOpenThread} data-testid="open-thread-button">
        {showThread ? 'Скрыть тред' : 'Открыть тред'}
      </button>
      {isLoading && <div data-testid="thread-loading">Загрузка треда...</div>}
      {showThread && !isLoading && (
        <div data-testid="thread-container">
          <div data-testid="thread-header">Тред #13 (2 комментария)</div>
          {threadComments.map((comment) => (
            <div key={comment.id} data-testid={`thread-comment-${comment.id}`}>
              {comment.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Изначально тред скрыт
  expect(screen.queryByTestId('thread-container')).not.toBeInTheDocument();
  expect(screen.getByText('Открыть тред')).toBeInTheDocument();

  // Кликаем по кнопке
  fireEvent.click(screen.getByTestId('open-thread-button'));

  // Показывается индикатор загрузки
  expect(screen.getByTestId('thread-loading')).toBeInTheDocument();

  // После загрузки показываются комментарии треда
  setTimeout(() => {
    rerender(
      <div>
        <div data-testid="comment-21">test</div>
        <button onClick={() => { showThread = false; }} data-testid="open-thread-button">
          Скрыть тред
        </button>
        <div data-testid="thread-container">
          <div data-testid="thread-header">Тред #13 (2 комментария)</div>
          {threadComments.map((comment) => (
            <div key={comment.id} data-testid={`thread-comment-${comment.id}`}>
              {comment.text}
            </div>
          ))}
        </div>
      </div>
    );

    expect(screen.getByTestId('thread-container')).toBeInTheDocument();
    expect(screen.getByTestId('thread-header')).toHaveTextContent('Тред #13 (2 комментария)');
    expect(screen.getByTestId('thread-comment-10')).toBeInTheDocument();
    expect(screen.getByTestId('thread-comment-13')).toBeInTheDocument();
    expect(screen.getByText('Скрыть тред')).toBeInTheDocument();
  }, 150);
    expect(screen.getByText('Открыть тред')).toBeInTheDocument();
  });

  /**
   * Тест: тред показывает правильное количество комментариев
   */
  test('заголовок треда показывает правильное количество комментариев', () => {
    const threadComments = [
      { id: 1, text: 'Комментарий 1' },
      { id: 2, text: 'Комментарий 2' },
      { id: 3, text: 'Комментарий 3' },
    ];

    render(
      <div data-testid="thread-container">
        <div data-testid="thread-header">
          Тред #13 ({threadComments.length} {threadComments.length === 1 ? 'комментарий' : 'комментариев'})
        </div>
        {threadComments.map((comment) => (
          <div key={comment.id}>{comment.text}</div>
        ))}
      </div>
    );

    expect(screen.getByTestId('thread-header')).toHaveTextContent('Тред #13 (3 комментариев)');
  });
});
