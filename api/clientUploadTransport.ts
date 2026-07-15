import { TRANSIENT_UPLOAD_STATUSES, UPLOAD_RETRY_DELAY_MS } from '@/api/clientTypes';
import { getApiRequestCredentials } from '@/utils/authPlatform';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

export const isTransientUploadStatus = (status: number): boolean =>
    TRANSIENT_UPLOAD_STATUSES.has(status);

const wait = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

export const fetchUploadWithTransientRetry = async (
    baseURL: string,
    endpoint: string,
    init: RequestInit,
    timeout: number,
    retries: number = 1
): Promise<Response> => {
    let attempt = 0;

    while (true) {
        const response = await fetchWithTimeout(
            `${baseURL}${endpoint}`,
            { ...init, ...getApiRequestCredentials() },
            timeout,
        );
        const shouldRetry =
            attempt < retries && !response.ok && isTransientUploadStatus(response.status);

        if (!shouldRetry) {
            return response;
        }

        attempt += 1;
        if (UPLOAD_RETRY_DELAY_MS > 0) {
            await wait(UPLOAD_RETRY_DELAY_MS);
        }
    }
};
