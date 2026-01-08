let Feather;
try {
  Feather = require('@expo/vector-icons/Feather');
} catch {
  Feather = null;
}

const FeatherComponent = (Feather && (Feather.default || Feather)) || function MaterialCommunityIconsStub() {
  return null;
};

module.exports = FeatherComponent;
module.exports.default = FeatherComponent;
module.exports.glyphMap = FeatherComponent.glyphMap || {};
module.exports.font = FeatherComponent.font || {};
