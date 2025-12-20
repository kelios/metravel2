/* global require, module */

const React = require('react');
const { View } = require('react-native');

module.exports = function LucideIconMock(props) {
  return React.createElement(View, { ...props, testID: 'lucide-icon-mock' });
};
