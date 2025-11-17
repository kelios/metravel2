// Stub для react-native-maps на веб-платформе
// Этот файл используется Metro resolver для замены react-native-maps на веб

const React = require('react');
const { View, Text } = require('react-native');

// Создаем пустые компоненты-заглушки
const EmptyComponent = () => React.createElement(View, null);

module.exports = {
  default: EmptyComponent,
  MapView: EmptyComponent,
  Marker: EmptyComponent,
  Callout: EmptyComponent,
  Polyline: EmptyComponent,
  Polygon: EmptyComponent,
  Circle: EmptyComponent,
  PROVIDER_GOOGLE: 'google',
  PROVIDER_DEFAULT: 'default',
  // Экспортируем все возможные подмодули
  __esModule: true,
}

