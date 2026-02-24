export const resolveExportedFunction = <T extends (...args: any[]) => any>(
  moduleRef: Record<string, unknown> | null | undefined,
  namedExport: string
): T | null => {
  if (!moduleRef || typeof moduleRef !== 'object') return null;

  const named = moduleRef[namedExport];
  if (typeof named === 'function') {
    return named as T;
  }

  const fallback = moduleRef.default;
  if (typeof fallback === 'function') {
    return fallback as T;
  }

  return null;
};
