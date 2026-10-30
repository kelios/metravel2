import {queueAnalyticsEvent} from '@/utils/analytics';
import {trackReadyBookEvent} from '@/utils/growthFunnelAnalytics';
jest.mock('@/utils/analytics',()=>({queueAnalyticsEvent:jest.fn(),sendAnalyticsEvent:jest.fn()}));
it('emits only the selected book metadata, never arbitrary payload or a print order',()=>{
  trackReadyBookEvent('ReadyBookDownloadStarted',{id:'belarus-memory',revision:'2026.1',country:'BY',email:'private@example.com'} as any,'pl',{profileId:'album-a5',artifactPurpose:'read',notes:'private'} as any);
  expect(queueAnalyticsEvent).toHaveBeenCalledWith('ReadyBookDownloadStarted',{book_id:'belarus-memory',revision:'2026.1',country:'BY',ui_locale:'pl',content_locale:'ru',profile_id:'album-a5',artifact_purpose:'read'});
});
