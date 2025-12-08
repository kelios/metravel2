import React, { Suspense, lazy } from 'react';
import { View } from 'react-native';
import { SectionSkeleton } from '@/components/SectionSkeleton';

// Lazy load components with code splitting
const LazyTravelDescription = lazy(() => 
  import('@/components/travel/TravelDescription')
);

const LazyPointList = lazy(() => 
  import('@/components/travel/PointList')
);

const LazyNearTravelList = lazy(() => 
  import('@/components/travel/NearTravelList')
);

const LazyPopularTravelList = lazy(() => 
  import('@/components/travel/PopularTravelList')
);

interface FastLoadingSectionProps {
  children: React.ReactNode;
  priority: 'immediate' | 'high' | 'normal' | 'low';
  fallback?: React.ReactNode;
}

// Component for optimized loading based on priority
export function FastLoadingSection({ 
  children, 
  priority, 
  fallback 
}: FastLoadingSectionProps) {
  const skeletonHeight = priority === 'immediate' ? 200 : 150;
  
  if (priority === 'immediate') {
    // Load immediately for LCP
    return <>{children}</>;
  }
  
  if (priority === 'high') {
    // Load with minimal delay for above-fold content
    return (
      <Suspense 
        fallback={fallback || <SectionSkeleton lines={3} height={skeletonHeight} />}
      >
        {children}
      </Suspense>
    );
  }
  
  // Normal and low priority with progressive loading
  return (
    <Suspense 
      fallback={fallback || <SectionSkeleton lines={2} height={100} />}
    >
      {children}
    </Suspense>
  );
}

// Optimized section components
export function OptimizedTravelDescription(props: any) {
  return (
    <FastLoadingSection priority="high">
      <LazyTravelDescription {...props} />
    </FastLoadingSection>
  );
}

export function OptimizedPointList(props: any) {
  return (
    <FastLoadingSection priority="normal">
      <LazyPointList {...props} />
    </FastLoadingSection>
  );
}

export function OptimizedNearTravelList(props: any) {
  return (
    <FastLoadingSection priority="low">
      <LazyNearTravelList {...props} />
    </FastLoadingSection>
  );
}

export function OptimizedPopularTravelList(props: any) {
  return (
    <FastLoadingSection priority="low">
      <LazyPopularTravelList {...props} />
    </FastLoadingSection>
  );
}

// Preloading utilities
export function preloadTravelComponents() {
  // Preload high-priority components
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      import('@/components/travel/TravelDescription');
      import('@/components/travel/PointList');
    });
  }
  
  // Preload normal-priority components after delay
  setTimeout(() => {
    import('@/components/travel/NearTravelList');
    import('@/components/travel/PopularTravelList');
  }, 2000);
}
