// Jest mock for react-native-svg.
// The real package ships untranspiled (Flow/TS) sources that are not in the
// jest transform allow-list, so we stub the elements used across the app with
// plain RN Views. Tests only need the components to render without throwing.
const React = require('react');
const { View } = require('react-native');

const make = (testID) => {
  const Comp = ({ children, ...props }) =>
    React.createElement(View, { testID, ...props }, children);
  Comp.displayName = testID;
  return Comp;
};

const Svg = make('svg');

module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  Circle: make('svg-circle'),
  Ellipse: make('svg-ellipse'),
  G: make('svg-g'),
  Text: make('svg-text'),
  TSpan: make('svg-tspan'),
  TextPath: make('svg-textpath'),
  Path: make('svg-path'),
  Polygon: make('svg-polygon'),
  Polyline: make('svg-polyline'),
  Line: make('svg-line'),
  Rect: make('svg-rect'),
  Use: make('svg-use'),
  Image: make('svg-image'),
  Symbol: make('svg-symbol'),
  Defs: make('svg-defs'),
  LinearGradient: make('svg-linear-gradient'),
  RadialGradient: make('svg-radial-gradient'),
  Stop: make('svg-stop'),
  ClipPath: make('svg-clippath'),
  Pattern: make('svg-pattern'),
  Mask: make('svg-mask'),
};
