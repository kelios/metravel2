// Minimal mock for @testing-library/dom to satisfy @testing-library/react in Jest

module.exports = {
  // Commonly used exports; we provide no-op implementations sufficient for our tests
  queries: {},
  getQueriesForElement: () => ({}),
  prettyDOM: () => '',
  fireEvent: new Proxy({}, {
    get: () => () => {},
  }),
  // Needed by @testing-library/react v16
  configure: () => {},
};
