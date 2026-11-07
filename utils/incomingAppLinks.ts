// Shared pure policy is also consumed by the Node static HTML generator.
export {
  ANDROID_APP_LINK_PATHS,
  classifyIncomingAppLink,
  isAndroidAppLinkPath,
  mapIncomingAppLinkToHref,
  mapNotificationPayloadToHref,
} from './incomingAppLinkPolicy';
export type { AndroidAppLinkPath, IncomingAppLinkDecision } from './incomingAppLinkPolicy';
