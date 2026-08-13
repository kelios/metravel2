/* global module, require */

const { createRunOncePlugin } = require('expo/config-plugins');
const {
  withNotificationsAndroid,
} = require('expo-notifications/plugin/build/withNotificationsAndroid');
const notificationsPackage = require('expo-notifications/package.json');

function withAndroidNotifications(config, props) {
  return withNotificationsAndroid(config, props || {});
}

module.exports = createRunOncePlugin(
  withAndroidNotifications,
  notificationsPackage.name,
  notificationsPackage.version,
);
