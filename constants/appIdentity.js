/* global module */

// Shared identity for application code and Node-generated Smart App Banners.
const ANDROID_APP_PACKAGE = 'by.metravel.app';
// App Store Connect numeric Apple ID, not the iOS bundle ID.
const APP_STORE_APP_ID = '6801264369';
const GOOGLE_PLAY_APP_URL = `https://play.google.com/store/apps/details?id=${ANDROID_APP_PACKAGE}`;
// No country code: App Store selects the visitor's storefront.
const APP_STORE_APP_URL = `https://apps.apple.com/app/id${APP_STORE_APP_ID}`;

module.exports = { ANDROID_APP_PACKAGE, APP_STORE_APP_ID, GOOGLE_PLAY_APP_URL, APP_STORE_APP_URL };
