// jest-expo automocks expo-linear-gradient's native view to `null`, which DROPS
// the children rendered inside a <LinearGradient> (e.g. the PlacePopupCard hero
// caption). Replace it with a plain View passthrough so tests can assert on
// caption content; the gradient paint itself is not part of any test contract.
const React = require('react');
const { View } = require('react-native');

// eslint-disable-next-line no-unused-vars -- strip gradient-only props before the View passthrough
const LinearGradient = ({ colors, locations, start, end, dither, ...viewProps }) =>
  React.createElement(View, viewProps);

module.exports = {
  __esModule: true,
  LinearGradient,
  default: LinearGradient,
};
