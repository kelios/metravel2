# CODE SPLITTING PLAN

**Created:** December 30, 2025  
**Phase:** 4 - Performance Optimization  
**Week:** 1 - Bundle Analysis  
**Status:** 🟢 INITIAL PLAN  

---

## 📋 Overview

This document outlines the code splitting strategy for metravel2 application to reduce initial bundle size from estimated ~350KB (gzipped) to target <250KB.

### Current State
- **Total Dependencies:** 79 (62 production, 17 dev)
- **Estimated Gzipped Size:** ~350KB (before splitting)
- **Target:** < 250KB (30% reduction)
- **Critical File:** TravelDetailsContainer.tsx (3055+ lines)

---

## 🎯 Splitting Strategy

### 1. Route-Based Code Splitting (Priority: HIGH)

**Target Routes:**
```
app/
├── home.js                 → Entry point (loaded with main)
├── (tabs)/
│   ├── home.tsx           → Split
│   ├── travels/           → Split
│   ├── favorites/         → Split
│   ├── profile/           → Split
│   └── settings/          → Split
├── modal.tsx              → Split (modals usually on-demand)
└── travel/[id]            → Split (detail pages)
```

**Implementation:**
- Use React Router lazy loading
- Implement Suspense boundaries
- Set up loading UI for each route

**Expected Reduction:** ~20-25% of main bundle

---

### 2. Component-Level Splitting (Priority: CRITICAL)

#### 2.1 TravelDetailsContainer.tsx (3055+ lines)

**Current Issues:**
- Monolithic component with mixed concerns
- Multiple feature areas in single file
- Difficult to test and maintain

**Proposed Structure:**
```
components/TravelDetails/
├── TravelDetailsContainer.tsx      (Main container, ~500 lines)
├── sections/
│   ├── TravelHeader.tsx            (~300 lines)
│   ├── TravelMetadata.tsx          (~250 lines)
│   ├── TravelStats.tsx             (~200 lines)
│   ├── TravelGallery.tsx           (~400 lines - with lazy images)
│   ├── TravelDescription.tsx       (~300 lines)
│   ├── TravelHighlights.tsx        (~250 lines)
│   ├── RelatedTravels.tsx          (~300 lines)
│   └── TravelActions.tsx           (~200 lines)
├── hooks/
│   ├── useTravelDetails.ts         (~150 lines)
│   ├── useTravelImages.ts          (~100 lines)
│   └── useTravelActions.ts         (~100 lines)
└── types/
    └── index.ts                    (Type definitions)
```

**Expected Reduction:** ~15-20% of app bundle + lazy loading benefits

**Steps:**
1. Extract each section into own component
2. Move hooks to dedicated files
3. Implement lazy loading for gallery images
4. Add React.memo for expensive components
5. Setup Suspense boundaries

---

### 3. Feature-Based Splitting (Priority: MEDIUM)

**Identify Feature-Specific Code:**

```
features/
├── travel/
│   ├── components/        → Travel-specific components
│   ├── hooks/            → Travel-specific hooks
│   ├── services/         → Travel API calls
│   ├── types/            → Travel types
│   └── index.ts          → Barrel export
│
├── authentication/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   └── types/
│
├── mapping/              → LAZY LOAD
│   └── ...               (Maps are heavy, only load when needed)
│
└── pdf-export/           → LAZY LOAD
    └── ...               (PDF generation, heavy dependency)
```

**Lazy Load Triggers:**
- `react-native-maps` → Only when user navigates to map view
- `@react-pdf/renderer` → Only when user requests PDF export
- Chart libraries → Only when viewing analytics

**Expected Reduction:** ~10-15%

---

### 4. Dependency Analysis (Priority: MEDIUM)

#### 4.1 Heavy Dependencies Review

| Dependency | Size | Status | Action |
|-----------|------|--------|--------|
| react-native-maps | 250KB | Used | Keep (consider lazy load) |
| react-native-reanimated | 200KB | Used | Keep (core animations) |
| react-native-paper | 200KB | Used | **Review alternatives** |
| @react-pdf/renderer | 200KB | Conditional | Lazy load |
| pdf-lib | 200KB | Conditional | Lazy load |
| @react-navigation/* | 150KB | Used | Keep (core routing) |
| react-native-gesture-handler | 150KB | Used | Keep (core gestures) |
| @tanstack/react-query | 80KB | Used | Keep (data fetching) |

#### 4.2 Potential Optimizations

**Replace react-native-paper:**
- Consider using smaller UI library or custom components
- Could save 200KB with custom Material Design implementation
- Estimate: ~15-20% reduction if replaced

**Consolidate PDF Generation:**
- Currently using both @react-pdf/renderer AND pdf-lib
- Choose one or lazy load both
- Estimate: ~200KB savings

---

### 5. Import Optimization (Priority: LOW)

**Issues to Fix:**
```typescript
// ❌ Bad - imports entire library
import { Button, Card, Text } from 'react-native-paper'

// ✅ Good - tree-shaking friendly
import Button from 'react-native-paper/lib/typescript/components/Button'
```

**Actions:**
1. Add ESLint rule for specific imports
2. Configure webpack to enable tree-shaking
3. Review and update all imports

**Expected Reduction:** ~5-10%

---

## 📊 Expected Results

### Before Optimization
```
Main Bundle: ~350KB (gzipped)
└─ Heavy deps: ~1710KB (uncompressed)
└─ Route bundles: None
└─ Feature bundles: None
```

### After Implementation

**Phase 1 (Week 2-3):**
- Route-based splitting: 280KB (gzipped)
- Component splitting: 240KB (gzipped)
- **Reduction: ~30%**

**Phase 2 (Week 4):**
- Lazy load maps: 210KB (gzipped)
- Lazy load PDF: 180KB (gzipped)
- **Reduction: ~48%**

**Final Target:**
- Main bundle: < 150KB (gzipped)
- Route chunks: 50-100KB each
- Feature chunks: 30-80KB each
- **Total savings: ~50-60%**

---

## 🔧 Implementation Roadmap

### Week 2: Route & Component Splitting
- [ ] Extract route-based chunks (React.lazy)
- [ ] Split TravelDetailsContainer
- [ ] Add Suspense boundaries
- [ ] Setup chunk loading indicators
- [ ] Generate bundle analysis reports

### Week 3: Advanced Splitting
- [ ] Implement feature-based chunks
- [ ] Add lazy load triggers
- [ ] Optimize imports (tree-shaking)
- [ ] Performance profiling
- [ ] Create monitoring dashboard

### Week 4: Finalization
- [ ] Documentation
- [ ] Performance regression tests
- [ ] Best practices guide
- [ ] Production optimization verification
- [ ] Team training materials

---

## 📈 Monitoring

### Key Metrics to Track
1. **Bundle Sizes**
   - Main bundle gzip size
   - Per-route chunk sizes
   - Per-feature chunk sizes

2. **Performance**
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Time to Interactive (TTI)
   - Cumulative Layout Shift (CLS)

3. **User Experience**
   - Page load time by route
   - Time to interactive by device
   - Chunk loading failures
   - Memory usage trends

### Tools
- webpack-bundle-analyzer
- Lighthouse CI
- Web Vitals monitoring
- Custom performance dashboard

---

## 🚀 Success Criteria

✅ Main bundle size < 250KB (gzipped)  
✅ Route chunks < 100KB each  
✅ LCP < 2.0s on desktop  
✅ LCP < 3.0s on mobile  
✅ 90+ Lighthouse score  
✅ No performance regressions  
✅ Automated testing in place  

---

## 📚 Related Documents

- Performance Plan: `docs/phases/PHASE3_PERFORMANCE_PLAN.md`
- Bundle Analysis: `docs/phases/PHASE4_WEEK1_REPORT.md`
- Metrics Baseline: `BASELINE_METRICS.json`
- Progress Tracker: `docs/phases/PHASE4_PROGRESS.md`

---

**Next Step:** Implement Week 2 route-based splitting (Start Day 3)

