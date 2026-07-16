import { queueAnalyticsEvent } from '@/utils/analytics';

export const GROWTH_FUNNEL_EVENTS = {
  registerCtaClick: 'cta_register_click',
  favoriteIntentGuest: 'favorite_intent_guest',
  registrationView: 'registration_view',
  registrationSubmit: 'registration_submit',
  registrationSuccess: 'registration_complete',
  registrationError: 'registration_error',
  contentCreateCtaClick: 'content_create_cta_click',
  contentCreateAuthGateView: 'content_create_auth_gate_view',
  routeCreateStarted: 'route_create_started',
  routeCreateDraftSaved: 'route_create_draft_saved',
  routeCreateDraftError: 'route_create_draft_error',
  routeCreatePublishAttempt: 'route_create_publish_attempt',
  routeCreatePublishBlocked: 'route_create_publish_blocked',
  routeCreatePublishSuccess: 'travel_publish',
  routeCreatePublishError: 'route_create_publish_error',
  articleEditorView: 'article_editor_view',
  articleEditorAutosaveSuccess: 'article_editor_autosave_success',
  articleEditorAutosaveError: 'article_editor_autosave_error',
  articleEditorPreviewClick: 'article_editor_preview_click',
} as const;

export type GrowthContentType = 'route' | 'article';
export type GrowthAuthState = 'guest' | 'authenticated';
export type GrowthRegistrationMethod = 'email' | 'google' | 'facebook';
export type GrowthRegistrationErrorReason = 'api' | 'exception' | 'provider';

type EventParams = Record<string, unknown>;

type RegistrationParams = {
  source?: unknown;
  intent?: unknown;
  redirect?: unknown;
  method?: GrowthRegistrationMethod;
};

type RegistrationErrorParams = RegistrationParams & {
  reason: GrowthRegistrationErrorReason;
};

type ContentCreateParams = {
  contentType: GrowthContentType;
  source?: unknown;
  authState?: GrowthAuthState;
  intent?: unknown;
  action?: unknown;
};

type RouteCreateParams = {
  source?: unknown;
  travelId?: unknown;
  step?: unknown;
  isNew?: boolean;
  fieldsCompletedCount?: number;
  hasName?: boolean;
  hasDescription?: boolean;
  hasCountries?: boolean;
  hasRoute?: boolean;
  hasPhotos?: boolean;
  missingFieldsCount?: number;
  firstMissingField?: unknown;
  checklistCompletedCount?: number;
  checklistTotalCount?: number;
  errorType?: unknown;
};

type ArticleEditorParams = {
  source?: unknown;
  travelId?: unknown;
  variant?: unknown;
  contentLength?: number;
};

const EVENT_VALUE_MAX_LENGTH = 120;

const firstValue = (value: unknown) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const safeString = (value: unknown, maxLength = EVENT_VALUE_MAX_LENGTH) => {
  const next = firstValue(value);
  if (typeof next !== 'string' && typeof next !== 'number' && typeof next !== 'boolean') {
    return undefined;
  }

  const trimmed = String(next).trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

const safePath = (value: unknown) => {
  const next = safeString(value, 240);
  if (!next || !next.startsWith('/')) return undefined;
  return next.split(/[?#]/)[0]?.slice(0, EVENT_VALUE_MAX_LENGTH) || undefined;
};

const safeNumber = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
};

const compactParams = (params: EventParams) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );

const emitGrowthFunnelEvent = (
  eventName: (typeof GROWTH_FUNNEL_EVENTS)[keyof typeof GROWTH_FUNNEL_EVENTS],
  params: EventParams = {},
) => {
  if (typeof queueAnalyticsEvent !== 'function') return;
  queueAnalyticsEvent(eventName, compactParams(params));
};

type RegisterCtaParams = {
  source?: unknown;
  intent?: unknown;
  authState?: GrowthAuthState;
};

type FavoriteIntentParams = {
  itemType: 'travel' | 'article';
  itemId?: unknown;
  source?: unknown;
  url?: unknown;
};

/**
 * Единая активационная цель `cta_register_click` (тикет #768): любой клик по
 * CTA «Зарегистрироваться» в любом месте UI. Точечные события конкретных
 * поверхностей (quest_guest_gate_register_click и т.п.) остаются как детализация.
 */
export const trackRegisterCtaClicked = ({ source, intent, authState }: RegisterCtaParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.registerCtaClick, {
    source: safeString(source) ?? 'unknown',
    intent: safeString(intent),
    auth_state: authState,
  });
};

export const trackFavoriteIntentGuest = ({ itemType, itemId, source, url }: FavoriteIntentParams) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.favoriteIntentGuest, {
    item_type: itemType,
    item_id: safeString(itemId),
    source: safeString(source) ?? 'unknown',
    url: safePath(url),
    auth_state: 'guest',
  });
};

const registrationBaseParams = ({ source, intent, redirect, method }: RegistrationParams) => ({
  source: safeString(source) ?? 'registration',
  intent: safeString(intent),
  redirect: safePath(redirect),
  method,
});

export const trackRegistrationViewed = (params: RegistrationParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.registrationView, registrationBaseParams(params));
};

export const trackRegistrationSubmitted = (params: RegistrationParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.registrationSubmit, registrationBaseParams(params));
};

export const trackRegistrationSucceeded = (params: RegistrationParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.registrationSuccess, registrationBaseParams(params));
};

export const trackRegistrationFailed = (params: RegistrationErrorParams) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.registrationError, {
    ...registrationBaseParams(params),
    error_type: safeString(params.reason),
  });
};

export const trackContentCreateCtaClicked = ({
  contentType,
  source,
  authState,
  intent,
  action,
}: ContentCreateParams) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.contentCreateCtaClick, {
    content_type: contentType,
    source: safeString(source),
    auth_state: authState,
    intent: safeString(intent),
    action: safeString(action),
  });
};

export const trackContentCreateAuthGateViewed = ({
  contentType,
  source,
  intent,
}: Pick<ContentCreateParams, 'contentType' | 'source' | 'intent'>) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.contentCreateAuthGateView, {
    content_type: contentType,
    source: safeString(source),
    auth_state: 'guest',
    intent: safeString(intent),
  });
};

const routeBaseParams = ({ source, travelId, step }: RouteCreateParams) => ({
  content_type: 'route',
  source: safeString(source),
  travel_id: safeString(travelId),
  step: safeNumber(step),
});

export const trackRouteCreateStarted = (params: RouteCreateParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.routeCreateStarted, routeBaseParams(params));
};

export const trackRouteCreateDraftSaved = (params: RouteCreateParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.routeCreateDraftSaved, {
    ...routeBaseParams(params),
    fields_completed_count: safeNumber(params.fieldsCompletedCount),
    has_name: params.hasName,
    has_description: params.hasDescription,
    has_countries: params.hasCountries,
    has_route: params.hasRoute,
    has_photos: params.hasPhotos,
  });
};

export const trackRouteCreateDraftFailed = (params: RouteCreateParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.routeCreateDraftError, {
    ...routeBaseParams(params),
    error_type: safeString(params.errorType) ?? 'save_failed',
  });
};

export const trackRouteCreatePublishAttempted = (params: RouteCreateParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.routeCreatePublishAttempt, {
    ...routeBaseParams(params),
    is_new: params.isNew,
    missing_fields_count: safeNumber(params.missingFieldsCount),
  });
};

export const trackRouteCreatePublishBlocked = (params: RouteCreateParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.routeCreatePublishBlocked, {
    ...routeBaseParams(params),
    missing_fields_count: safeNumber(params.missingFieldsCount),
    first_missing_field: safeString(params.firstMissingField),
  });
};

export const trackRouteCreatePublishSucceeded = (params: RouteCreateParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.routeCreatePublishSuccess, {
    ...routeBaseParams(params),
    checklist_completed_count: safeNumber(params.checklistCompletedCount),
    checklist_total_count: safeNumber(params.checklistTotalCount),
  });
};

export const trackRouteCreatePublishFailed = (params: RouteCreateParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.routeCreatePublishError, {
    ...routeBaseParams(params),
    error_type: safeString(params.errorType) ?? 'save_failed',
  });
};

const articleBaseParams = ({ source, travelId, variant, contentLength }: ArticleEditorParams) => ({
  content_type: 'article',
  source: safeString(source),
  travel_id: safeString(travelId),
  variant: safeString(variant),
  content_length: safeNumber(contentLength),
});

export const trackArticleEditorViewed = (params: ArticleEditorParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.articleEditorView, articleBaseParams(params));
};

export const trackArticleEditorAutosaveSucceeded = (params: ArticleEditorParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.articleEditorAutosaveSuccess, articleBaseParams(params));
};

export const trackArticleEditorAutosaveFailed = (params: ArticleEditorParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.articleEditorAutosaveError, articleBaseParams(params));
};

export const trackArticleEditorPreviewClicked = (params: ArticleEditorParams = {}) => {
  emitGrowthFunnelEvent(GROWTH_FUNNEL_EVENTS.articleEditorPreviewClick, articleBaseParams(params));
};
