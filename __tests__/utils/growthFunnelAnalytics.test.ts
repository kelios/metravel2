import { queueAnalyticsEvent } from '@/utils/analytics';
import {
  GROWTH_FUNNEL_EVENTS,
  trackArticleEditorAutosaveSucceeded,
  trackContentCreateCtaClicked,
  trackRegistrationFailed,
  trackRegistrationViewed,
  trackRouteCreateDraftSaved,
  trackRouteCreatePublishBlocked,
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
