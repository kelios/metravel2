/* global module, require */

const { APP_STORE_APP_ID, ANDROID_APP_PACKAGE, GOOGLE_PLAY_APP_URL } = require('../constants/appIdentity');
const { mapIncomingAppLinkToHref } = require('./incomingAppLinkPolicy');

const DEFAULT_APP_PATH = '/map';
const getMobileAppPath = (siteUrl) => mapIncomingAppLinkToHref(siteUrl) ?? DEFAULT_APP_PATH;

/** Only destinations accepted by native ingress can be offered by the website. */
function getMobileAppUrl(siteUrl) {
  return `metravel:/${getMobileAppPath(siteUrl)}`;
}

/** Construction never probes installation or initiates navigation. */
function getMobileAppOpenUrl(platform, siteUrl) {
  if (platform === 'ios') return getMobileAppUrl(siteUrl);

  // Keep URL escapes intact while preventing raw semicolons from adding Intent
  // extras. Native ingress has already removed any page fragment.
  const appPath = getMobileAppPath(siteUrl).replace(/;/g, '%3B');
  return `intent://metravel.by${appPath}#Intent;scheme=https;package=${ANDROID_APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(GOOGLE_PLAY_APP_URL)};end`;
}

function getSmartAppBannerContent(siteUrl = '') {
  // A comma delimits Smart Banner arguments, including inside a route query.
  const appArgument = getMobileAppUrl(siteUrl).replace(/,/g, '%2C');
  return `app-id=${APP_STORE_APP_ID}, app-argument=${appArgument}`;
}

module.exports = { getMobileAppUrl, getMobileAppOpenUrl, getSmartAppBannerContent };
