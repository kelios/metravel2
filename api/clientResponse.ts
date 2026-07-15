import { Platform } from 'react-native';

import { ApiError } from '@/api/clientErrors';
import type { DownloadResponse } from '@/api/clientTypes';
import { parseDownloadFilename } from '@/api/clientTypes';
import { translate as i18nT } from '@/i18n';
import { getApiErrorMessage, getErrorTextField } from '@/utils/errorHelpers';
import { devError } from '@/utils/logger';

export const parseErrorBody = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

export const throwDetailedError = async (response: Response): Promise<never> => {
    const errorText = await response.text().catch(() => 'Unknown error');
    const errorData = parseErrorBody(errorText);
    const fallbackStatusText = response.statusText || `HTTP ${response.status}`;
    throw new ApiError(
        response.status,
        getApiErrorMessage(errorData, fallbackStatusText),
        errorData
    );
};

export const parseSuccessResponse = async <T>(response: Response): Promise<T> => {
    if (response.status === 204) {
        return null as T;
    }

    const maybeTextFn = (response as Partial<Response>)?.text;
    if (typeof maybeTextFn === 'function') {
        const text = await response.text().catch(() => '');
        if (!text) {
            return null as T;
        }
        try {
            return JSON.parse(text) as T;
        } catch {
            if (__DEV__) {
                devError('Ошибка парсинга JSON в parseSuccessResponse:', text.substring(0, 100));
            }
            return null as T;
        }
    }

    const maybeJsonFn = (response as Partial<Response>)?.json;
    if (typeof maybeJsonFn === 'function') {
        return (await response.json()) as T;
    }

    return null as T;
};

export const parseDownloadResponse = async (response: Response): Promise<DownloadResponse> => {
    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const errorData = parseErrorBody(errorText);
        throw new ApiError(
            response.status,
            getErrorTextField(errorData, 'message') ||
                getErrorTextField(errorData, 'detail') ||
                i18nT('errorsStatic:api.common.requestFailed', { details: response.statusText }),
            errorData
        );
    }

    const contentType = response.headers.get('content-type') ?? undefined;
    const filename = parseDownloadFilename(response.headers.get('content-disposition'));
    const blob =
        Platform.OS === 'web'
            ? await response.blob()
            : ({ text: () => response.text() } as Blob);
    return { blob, contentType, filename };
};
