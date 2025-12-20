/* global jest, module */

// Lightweight wrapper around the real @testing-library/dom exports so the
// module isn't missing newer helpers (e.g. getConfig used by
// @testing-library/react v16). We keep the file to allow Jest's manual mock
// resolution but simply re-export the actual implementation.
const actual = jest.requireActual('@testing-library/dom');

module.exports = {
  ...actual,
};
