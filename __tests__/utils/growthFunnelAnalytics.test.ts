import { queueAnalyticsEvent } from '@/utils/analytics';
import {
  GROWTH_FUNNEL_EVENTS,
  trackArticleEditorAutosaveSucceeded,
  trackContentCreateCtaClicked,
  trackRegisterCtaClicked,
  trackRegistrationFailed,
  trackRegistrationSucceeded,
  trackRegistrationViewed,
  trackRouteCreateDraftSaved,
  trackRouteCreatePublishBlocked,
  trackRouteCreatePublishSucceeded,
} from '@/utils/growthFunnelAnalytics';

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}));

const mockedQueueAnalyticsEvent = queueAnalyticsEvent as jest.MockedFunction<
  typeof queueAnalyticsEvent
>;

describe('growthFunnelAnalytics', () => {
  beforeEach(() => {
    mockedQueueAnalyticsEvent.mockClear();
  });

  it('tracks registration views with safe funnel dimensions', () => {
    trackRegistrationViewed({
      source: 'registration',
      intent: 'create-travel',
      redirect: '/travel/new?token=secret',
    });

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.registrationView,
      {
        source: 'registration',
        intent: 'create-travel',
        redirect: '/travel/new',
      },
    );
  });

  it('keeps activation goal ids aligned with the Metrika task contract', () => {
    expect([
      GROWTH_FUNNEL_EVENTS.registrationSuccess,
      'login_success',
      'quest_start',
      'quest_point_done',
      'quest_finish',
      'favorite_add',
      GROWTH_FUNNEL_EVENTS.routeCreatePublishSuccess,
      'cta_register_click',
    ]).toEqual([
      'registration_complete',
      'login_success',
      'quest_start',
      'quest_point_done',
      'quest_finish',
      'favorite_add',
      'travel_publish',
      'cta_register_click',
    ]);
  });

  it('tracks unified register CTA clicks with the contract goal id', () => {
    trackRegisterCtaClicked({ source: 'login_form', intent: 'quest', authState: 'guest' });

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.registerCtaClick,
      {
        source: 'login_form',
        intent: 'quest',
        auth_state: 'guest',
      },
    );
    expect(GROWTH_FUNNEL_EVENTS.registerCtaClick).toBe('cta_register_click');
  });

  it('falls back to unknown source and drops empty register CTA params', () => {
    trackRegisterCtaClicked();

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.registerCtaClick,
      { source: 'unknown' },
    );
  });

  it('emits contract registration and publish goal ids', () => {
    trackRegistrationSucceeded({ source: 'registration', method: 'email' });
    trackRouteCreatePublishSucceeded({
      travelId: '42',
      step: 6,
      checklistCompletedCount: 5,
      checklistTotalCount: 5,
    });

    expect(mockedQueueAnalyticsEvent).toHaveBeenNthCalledWith(
      1,
      'registration_complete',
      {
        source: 'registration',
        method: 'email',
      },
    );
    expect(mockedQueueAnalyticsEvent).toHaveBeenNthCalledWith(
      2,
      'travel_publish',
      {
        content_type: 'route',
        travel_id: '42',
        step: 6,
        checklist_completed_count: 5,
        checklist_total_count: 5,
      },
    );
  });

  it('omits unsafe or empty registration values', () => {
    trackRegistrationFailed({
      source: '',
      intent: undefined,
      redirect: 'https://example.com/reset?token=secret',
      method: 'email',
      reason: 'api',
    });

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.registrationError,
      {
        source: 'registration',
        method: 'email',
        error_type: 'api',
      },
    );
  });

  it('tracks content creation CTA clicks as a normalized funnel step', () => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: 'contribution_banner_articles',
      authState: 'guest',
      intent: 'add-place',
      action: 'register',
    });

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.contentCreateCtaClick,
      {
        content_type: 'route',
        source: 'contribution_banner_articles',
        auth_state: 'guest',
        intent: 'add-place',
        action: 'register',
      },
    );
  });

  it('tracks route draft completeness without text content', () => {
    trackRouteCreateDraftSaved({
      travelId: '42',
      step: 6,
      fieldsCompletedCount: 4,
      hasName: true,
      hasDescription: false,
      hasCountries: true,
      hasRoute: true,
      hasPhotos: true,
    });

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.routeCreateDraftSaved,
      {
        content_type: 'route',
        travel_id: '42',
        step: 6,
        fields_completed_count: 4,
        has_name: true,
        has_description: false,
        has_countries: true,
        has_route: true,
        has_photos: true,
      },
    );
  });

  it('tracks publish blockers with field keys only', () => {
    trackRouteCreatePublishBlocked({
      travelId: '42',
      step: 6,
      missingFieldsCount: 2,
      firstMissingField: 'categories',
    });

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.routeCreatePublishBlocked,
      {
        content_type: 'route',
        travel_id: '42',
        step: 6,
        missing_fields_count: 2,
        first_missing_field: 'categories',
      },
    );
  });

  it('tracks article autosave metadata without article body', () => {
    trackArticleEditorAutosaveSucceeded({
      source: 'article_editor_web',
      travelId: '42',
      variant: 'compact',
      contentLength: 1280,
    });

    expect(mockedQueueAnalyticsEvent).toHaveBeenCalledWith(
      GROWTH_FUNNEL_EVENTS.articleEditorAutosaveSuccess,
      {
        content_type: 'article',
        source: 'article_editor_web',
        travel_id: '42',
        variant: 'compact',
        content_length: 1280,
      },
    );
  });
});
