/** HTTP/2 can omit the reason phrase. Keep the code without inventing UI copy. */
export const formatHttpStatus = (status: number, statusText: string): string =>
    `${status} ${statusText}`.trim();
