// metro-stubs/react-native-web-slim.js
// I2.2: Cherry-picked re-exports of react-native-web modules actually used in the app.
// This file is aliased in metro.config.js resolveRequest so that
// `import { View, Text, ... } from 'react-native'` on web only pulls in the
// modules we actually use, instead of the full react-native-web barrel.
//
// Generated from docs/RNW_USAGE_AUDIT.md (2026-03-02).
//
// IMPORTANT: When adding new RN imports to the codebase, also add them here.

'use strict';

// Core components
const View = require('react-native-web/dist/exports/View').default;
const Text = require('react-native-web/dist/exports/Text').default;
const Image = require('react-native-web/dist/exports/Image').default;
const TextInput = require('react-native-web/dist/exports/TextInput').default;
const ScrollView = require('react-native-web/dist/exports/ScrollView').default;
const FlatList = require('react-native-web/dist/exports/FlatList').default;
const Pressable = require('react-native-web/dist/exports/Pressable').default;
const TouchableOpacity = require('react-native-web/dist/exports/TouchableOpacity').default;
const Modal = require('react-native-web/dist/exports/Modal').default;
const ActivityIndicator = require('react-native-web/dist/exports/ActivityIndicator').default;
const SafeAreaView = require('react-native-web/dist/exports/SafeAreaView').default;
const RefreshControl = require('react-native-web/dist/exports/RefreshControl').default;
const KeyboardAvoidingView = require('react-native-web/dist/exports/KeyboardAvoidingView').default;
const StatusBar = require('react-native-web/dist/exports/StatusBar').default;

// Layout / Utilities
const StyleSheet = require('react-native-web/dist/exports/StyleSheet').default;
const Platform = require('react-native-web/dist/exports/Platform').default;
const Dimensions = require('react-native-web/dist/exports/Dimensions').default;
const Animated = require('react-native-web/dist/exports/Animated').default;
const Easing = require('react-native-web/dist/exports/Easing').default;
const LayoutAnimation = require('react-native-web/dist/exports/LayoutAnimation').default;
const UIManager = require('react-native-web/dist/exports/UIManager').default;
const AppState = require('react-native-web/dist/exports/AppState').default;
const AccessibilityInfo = require('react-native-web/dist/exports/AccessibilityInfo').default;
const InteractionManager = require('react-native-web/dist/exports/InteractionManager').default;
const PixelRatio = require('react-native-web/dist/exports/PixelRatio').default;
const Linking = require('react-native-web/dist/exports/Linking').default;
const Share = require('react-native-web/dist/exports/Share').default;
const useWindowDimensions = require('react-native-web/dist/exports/useWindowDimensions').default;
const useColorScheme = require('react-native-web/dist/exports/useColorScheme').default;

// Event types
const LayoutChangeEvent = undefined; // Type-only, no runtime value

module.exports = {
  // Components
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  KeyboardAvoidingView,
  StatusBar,

  // Utilities
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
  AppState,
  AccessibilityInfo,
  InteractionManager,
  PixelRatio,
  Linking,
  Share,
  useWindowDimensions,
  useColorScheme,
};

