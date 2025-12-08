import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { calculateColumns } from './utils/listTravelHelpers';

const shimmerColor = Platform.select({
    web: 'rgba(226, 232, 240, 0.4)',
    default: 'rgba(226, 232, 240, 0.6)',
});

const blocks = Array.from({ length: 6 });

export default function ListTravelSkeleton() {
    const { width } = useWindowDimensions();
    
    const columns = useMemo(() => calculateColumns(width), [width]);
    const isMobile = width < 768; // Matching ListTravel logic approx

    return (
        <View style={styles.wrapper} accessibilityRole="progressbar">
            {/* Filter Row Skeleton */}
            <View style={[styles.filterRow, isMobile && styles.filterRowMobile]}>
                {!isMobile && (
                  <View style={styles.sidebarSkeleton}>
                     {Array.from({ length: 5 }).map((_, i) => (
                        <View key={i} style={styles.filterGroupSkeleton} />
                     ))}
                  </View>
                )}
                
                <View style={styles.mainContentSkeleton}>
                   {/* Search Bar Skeleton */}
                   <View style={styles.searchBarSkeleton} />

                   {/* Grid Skeleton */}
                   <View style={styles.grid}>
                       {blocks.map((_, index) => (
                           <View 
                             key={`skeleton-${index}`} 
                             style={[
                               styles.card, 
                               { 
                                 width: '100%',
                                 marginBottom: DESIGN_TOKENS.spacing.sm,
                               }
                             ]}
                           >
                               <View style={styles.imagePlaceholder} />
                               <View style={styles.textBlock}>
                                   <View style={[styles.line, styles.linePrimary]} />
                                   <View style={[styles.line, styles.lineSecondary]} />
                                   <View style={[styles.line, styles.lineShort]} />
                               </View>
                           </View>
                       ))}
                   </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: '#fafbfc',
    },
    filterRow: {
        flexDirection: 'row',
        maxWidth: 1600,
        marginHorizontal: 'auto',
        width: '100%',
        paddingTop: Platform.select({ default: 16, web: 32 }),
        gap: Platform.select({ default: 0, web: 40 }),
    },
    filterRowMobile: {
        flexDirection: 'column',
        paddingTop: 12,
        gap: 16,
    },
    sidebarSkeleton: {
        width: Platform.select({ default: 260, web: 300 }),
        paddingLeft: Platform.select({ default: 16, web: 20 }),
        gap: 24,
    },
    filterGroupSkeleton: {
        height: 100,
        backgroundColor: shimmerColor,
        borderRadius: 12,
    },
    mainContentSkeleton: {
        flex: 1,
        paddingLeft: Platform.select({ default: DESIGN_TOKENS.spacing.sm, web: 32 }),
        paddingRight: Platform.select({ default: DESIGN_TOKENS.spacing.sm, web: 40 }),
    },
    searchBarSkeleton: {
        height: 44,
        borderRadius: 22,
        backgroundColor: shimmerColor,
        marginBottom: 32,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    card: {
        borderRadius: Platform.select({ default: 20, web: 24 }),
        backgroundColor: DESIGN_TOKENS.colors.surface,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        aspectRatio: 0.85,
        ...Platform.select({
            web: {
                boxSizing: 'border-box' as any,
            },
        }),
    },
    imagePlaceholder: {
        width: '100%',
        height: '60%',
        backgroundColor: shimmerColor,
    },
    textBlock: {
        padding: 16,
        gap: 10,
        flex: 1,
    },
    line: {
        height: 14,
        backgroundColor: shimmerColor,
        borderRadius: 8,
    },
    linePrimary: {
        width: '80%',
        height: 18,
    },
    lineSecondary: {
        width: '60%',
    },
    lineShort: {
        width: '40%',
    },
});

