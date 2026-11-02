import {queueAnalyticsEvent} from '@/utils/analytics';
import {trackReadyBookEvent,trackReadyBookRelatedOpened} from '@/utils/growthFunnelAnalytics';
jest.mock('@/utils/analytics',()=>({queueAnalyticsEvent:jest.fn(),sendAnalyticsEvent:jest.fn()}));
it('emits only the selected book metadata, never arbitrary payload or a print order',()=>{
  trackReadyBookEvent('ReadyBookDownloadRequested',{id:'belarus-memory',revision:'2026.1',country:'BY',email:'private@example.com'} as any,'pl',{profileId:'album-a5',artifactPurpose:'read',profileSource:'default',notes:'private'} as any);
  expect(queueAnalyticsEvent).toHaveBeenCalledWith('ReadyBookDownloadRequested',{book_id:'belarus-memory',revision:'2026.1',country:'BY',ui_locale:'pl',content_locale:'ru',profile_id:'album-a5',artifact_purpose:'read',profile_source:'default'});
});
it('names a contextual entry by edition slug and its source only',()=>{
  trackReadyBookRelatedOpened({slug:'belarus',country:'BY',title:'Беларусь',pointIds:[1]} as any,'place','be');
  expect(queueAnalyticsEvent).toHaveBeenLastCalledWith('ReadyBookRelatedOpened',{book_slug:'belarus',country:'BY',entry_source:'place',ui_locale:'be'});
});
