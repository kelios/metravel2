// Stub для Map.ios на веб-платформе
// Этот файл используется Metro resolver для замены Map.ios на веб
// Используем CommonJS для совместимости с Metro

const React = require('react');
const { View, Text } = require('react-native');

const MapIOSStub = () => {
  return React.createElement(
    View,
    { style: { padding: 20, alignItems: 'center', justifyContent: 'center', minHeight: 200 } },
    React.createElement(Text, null, 'Карта доступна только на нативных платформах')
  );
};

module.exports = MapIOSStub;
module.exports.default = MapIOSStub;

