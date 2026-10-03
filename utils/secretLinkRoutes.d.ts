export type SecretLinkRoute = {
  readonly route: string;
  readonly secretParams: readonly string[];
};

export const SECRET_LINK_ROUTES: readonly SecretLinkRoute[];
export const SECRET_LINK_QUERY_PARAMS: readonly string[];
export const SECRET_LINK_ROUTE_PATHS: readonly string[];
