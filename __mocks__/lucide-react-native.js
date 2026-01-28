/* global require, module */

const icon = require('./lucideIconMock');

// Return a component for any named export (AlertCircle, RotateCw, etc.)
const proxied = new Proxy(
  {},
  {
    get: () => icon,
  }
);

module.exports = proxied;
module.exports.default = proxied;

