function getLeaflet() {
  if (typeof window !== 'undefined' && window.L) {
    return window.L;
  }
  return {};
}

const leafletProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      const L = getLeaflet();
      return L[prop];
    },
    has(_target, prop) {
      const L = getLeaflet();
      return prop in L;
    },
    ownKeys() {
      const L = getLeaflet();
      return Reflect.ownKeys(L);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const L = getLeaflet();
      const desc = Object.getOwnPropertyDescriptor(L, prop);
      if (desc) return desc;
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: undefined,
      };
    },
  }
);

module.exports = leafletProxy;
module.exports.default = leafletProxy;
