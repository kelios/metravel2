'use strict';

// Suppress noisy React Native Web AppRegistry startup banner.
// This banner is printed by react-native-web when NODE_ENV is not production/test.
// We filter only that specific message to keep other logs intact.
const originalLog = console.log;
console.log = (...args) => {
  const first = args[0];
  if (typeof first === 'string' && first.startsWith('Running application "main" with appParams:')) {
    return;
  }
  return originalLog(...args);
};

// Suppress FontFaceObserver timeout errors that often surface as
// `Uncaught (in promise) Error: 6000ms timeout exceeded` on web.
// We only prevent default for this specific known case.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('error', (event) => {
    const message =
      typeof event?.message === 'string'
        ? event.message
        : event?.error && typeof event.error.message === 'string'
          ? event.error.message
          : '';

    const stack =
      event?.error && typeof event.error.stack === 'string'
        ? event.error.stack
        : '';

    const filename = typeof event?.filename === 'string' ? event.filename : '';

    const isFontObserverTimeout =
      message.includes('timeout exceeded') &&
      (stack.toLowerCase().includes('fontfaceobserver') ||
        filename.toLowerCase().includes('fontfaceobserver') ||
        message.toLowerCase().includes('fontfaceobserver'));

    if (isFontObserverTimeout) {
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;

    const message =
      typeof reason === 'string'
        ? reason
        : reason && typeof reason.message === 'string'
          ? reason.message
          : '';

    const stack =
      reason && typeof reason.stack === 'string'
        ? reason.stack
        : '';

    const isFontObserverTimeout =
      message.includes('timeout exceeded') &&
      (stack.toLowerCase().includes('fontfaceobserver') ||
        message.toLowerCase().includes('fontfaceobserver'));

    if (isFontObserverTimeout) {
      event.preventDefault();
    }
  });
}

require('expo-router/entry');
