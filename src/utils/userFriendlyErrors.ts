// src/utils/userFriendlyErrors.ts
// ✅ Утилита для преобразования технических ошибок в понятные сообщения для пользователей

/**
 * Преобразует техническую ошибку в понятное сообщение для пользователя
 */
export function getUserFriendlyError(error: Error | string | unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error || 'Неизвестная ошибка');

    // Сетевые ошибки
    if (/network|fetch|connection|timeout/i.test(errorMessage)) {
        return 'Проблема с подключением к интернету. Проверьте соединение и попробуйте снова.';
    }

    if (/timeout|превышено время/i.test(errorMessage)) {
        return 'Превышено время ожидания. Сервер не отвечает. Попробуйте позже.';
    }

    // Ошибки авторизации
    if (/401|unauthorized|не авторизован/i.test(errorMessage)) {
        return 'Требуется авторизация. Пожалуйста, войдите в систему.';
    }

    if (/403|forbidden|доступ запрещен/i.test(errorMessage)) {
        return 'Доступ запрещен. У вас нет прав для выполнения этого действия.';
    }

    // Ошибки валидации
    if (/400|validation|invalid|некорректн/i.test(errorMessage)) {
        return 'Некорректные данные. Проверьте введенную информацию.';
    }

    // Ошибки сервера
    if (/500|502|503|504|server error|ошибка сервера/i.test(errorMessage)) {
        return 'Ошибка на сервере. Мы уже работаем над исправлением. Попробуйте позже.';
    }

    // Ошибки загрузки файлов
    if (/file|upload|загрузк/i.test(errorMessage)) {
        if (/size|размер/i.test(errorMessage)) {
            return 'Файл слишком большой. Выберите файл меньшего размера.';
        }
        if (/format|формат|type/i.test(errorMessage)) {
            return 'Неподдерживаемый формат файла. Выберите другой файл.';
        }
        return 'Ошибка при загрузке файла. Попробуйте еще раз.';
    }

    // Ошибки парсинга
    if (/json|parse|парсинг/i.test(errorMessage)) {
        return 'Ошибка при обработке данных. Попробуйте обновить страницу.';
    }

    // Специфичные ошибки приложения
    if (/не найдено|not found|404/i.test(errorMessage)) {
        return 'Запрашиваемый ресурс не найден.';
    }

    if (/email|почт/i.test(errorMessage) && /invalid|некорректн/i.test(errorMessage)) {
        return 'Некорректный email адрес. Проверьте правильность ввода.';
    }

    if (/password|пароль/i.test(errorMessage)) {
        if (/weak|слаб/i.test(errorMessage)) {
            return 'Пароль слишком слабый. Используйте более сложный пароль.';
        }
        if (/match|совпад/i.test(errorMessage)) {
            return 'Пароли не совпадают. Проверьте введенные пароли.';
        }
        return 'Ошибка с паролем. Проверьте правильность ввода.';
    }

    // Если сообщение уже понятное для пользователя, возвращаем его
    if (errorMessage.length < 100 && !/Error|Exception|at |stack/i.test(errorMessage)) {
        return errorMessage;
    }

    // Общее сообщение для неизвестных ошибок
    return 'Произошла ошибка. Попробуйте еще раз или обратитесь в поддержку.';
}

/**
 * Получает заголовок ошибки для отображения
 */
export function getErrorTitle(error: Error | string | unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error || '');

    if (/network|connection|timeout/i.test(errorMessage)) {
        return 'Проблема с подключением';
    }

    if (/401|unauthorized/i.test(errorMessage)) {
        return 'Требуется авторизация';
    }

    if (/403|forbidden/i.test(errorMessage)) {
        return 'Доступ запрещен';
    }

    if (/500|server error/i.test(errorMessage)) {
        return 'Ошибка сервера';
    }

    if (/validation|invalid/i.test(errorMessage)) {
        return 'Ошибка валидации';
    }

    return 'Ошибка';
}

/**
 * Проверяет, является ли ошибка критической (требует перезагрузки)
 */
export function isCriticalError(error: Error | string | unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error || '');
    
    return /500|502|503|504|server error|ошибка сервера/i.test(errorMessage);
}

