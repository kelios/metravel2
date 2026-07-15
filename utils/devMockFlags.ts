type DevMockFlagOptions = {
  name: string;
  value: string | undefined;
  defaultInDev?: boolean;
  isDev?: boolean;
};

/**
 * Keeps product mocks out of production and fails loudly on a bad production
 * configuration instead of silently serving fake success data.
 */
export const resolveDevMockFlag = ({
  name,
  value,
  defaultInDev = false,
  isDev = __DEV__ || process.env.NODE_ENV === 'test',
}: DevMockFlagOptions): boolean => {
  const requested = ['1', 'true'].includes(String(value ?? '').trim().toLowerCase());
  if (!isDev && requested) {
    throw new Error(`[config] ${name}=true is forbidden in production`);
  }
  return isDev && (requested || defaultInDev);
};
