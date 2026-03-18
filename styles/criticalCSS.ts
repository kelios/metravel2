/**
 * Critical CSS for above-the-fold content
 * Optimized for fastest First Paint and LCP
 */
import { DESIGN_COLORS } from '@/constants/designSystem';

export const criticalCSS = `
/* Critical CSS - Above the Fold Content */
/* Optimized for minimal render-blocking */

/* Base reset and critical layout */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: ${DESIGN_COLORS.criticalBgSecondaryLight};
  color: ${DESIGN_COLORS.criticalTextLight};
  line-height: 1.6;
}

/* Critical container */
.travel-details-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: ${DESIGN_COLORS.criticalBgSecondaryLight};
}

/* Hero section - LCP critical */
.hero-section {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 12px;
  overflow: hidden;
  background-color: ${DESIGN_COLORS.criticalBgTertiaryLight};
  margin-bottom: 16px;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 12px;
}

/* Loading skeleton */
.skeleton {
  background: linear-gradient(90deg, ${DESIGN_COLORS.criticalSurfaceLight} 25%, ${DESIGN_COLORS.criticalBgTertiaryLight} 50%, ${DESIGN_COLORS.criticalSurfaceLight} 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-text {
  height: 16px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.skeleton-title {
  height: 24px;
  border-radius: 6px;
  margin-bottom: 12px;
  width: 70%;
}

/* Critical typography */
.title {
  font-size: 24px;
  font-weight: 600;
  color: ${DESIGN_COLORS.criticalTextLight};
  margin: 0 0 8px 0;
  line-height: 1.3;
}

.subtitle {
  font-size: 16px;
  color: rgba(58, 58, 58, 0.72);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* Progress bar - critical for UX */
.progress-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background-color: rgba(0,0,0,0.08);
  z-index: 1000;
}

.progress-bar {
  height: 100%;
  background-color: var(--color-brand, rgb(245, 132, 44));
  width: 0%;
  transition: width 0.15s ease-out;
  box-shadow: 0 2px 4px rgba(245, 132, 44, 0.3);
}

/* Safe area handling */
.safe-area {
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
}

/* Critical navigation */
.nav-header {
  position: sticky;
  top: 0;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 100;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

/* Content wrapper */
.content-wrapper {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  .content-wrapper {
    padding: 32px;
  }
  
  .hero-section {
    margin-bottom: 24px;
  }
}

@media (min-width: 1024px) {
  .content-wrapper {
    padding: 48px;
  }
  
  .title {
    font-size: 32px;
  }
}

/* Performance optimizations */
.will-change-transform {
  will-change: transform;
}

.contain-layout {
  contain: layout style paint;
}

.gpu-accelerated {
  transform: translateZ(0);
  backface-visibility: hidden;
}

/* Critical button styles */
.btn-primary {
  background-color: var(--color-success, rgb(82, 125, 102));
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background-color: var(--color-successDark, rgb(66, 109, 86));
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

/* Focus styles for accessibility */
.btn-primary:focus-visible {
  outline: 2px solid var(--color-success, rgb(82, 125, 102));
  outline-offset: 2px;
}

/* Loading states */
.loading {
  opacity: 0.6;
  pointer-events: none;
}

.loading::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border: 2px solid ${DESIGN_COLORS.criticalSurfaceLight};
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error states */
.error {
  color: rgb(154, 99, 99);
  background-color: rgb(245, 240, 240);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(154, 99, 99, 0.22);
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  
  .skeleton {
    animation: none;
  }
  
  .progress-bar {
    transition: none;
  }
  
  .btn-primary {
    transition: none;
  }
}
`;

export function injectCriticalStyles() {
  if (typeof document === 'undefined') return;
  
  // Check if already injected
  if (document.querySelector('#critical-css')) return;
  
  const style = document.createElement('style');
  style.id = 'critical-css';
  style.textContent = criticalCSS;
  style.setAttribute('data-critical', 'true');
  
  // Insert at the beginning of head for highest priority
  const head = document.head;
  const firstChild = head.firstChild;
  if (firstChild) {
    head.insertBefore(style, firstChild);
  } else {
    head.appendChild(style);
  }
}
