import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import RenderRightMenu from './RenderRightMenu';

export default React.memo(function CustomHeader() {
    return (
      <View style={styles.container}>
          <View style={styles.wrapper}>
              <View style={styles.inner}>
                  <RenderRightMenu />
              </View>
          </View>
      </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
    },
    wrapper: {
        width: '100%',
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
        // Более мягкая тень для мобильных
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 2,
            },
            android: {
                elevation: 1,
                shadowColor: '#000',
            },
            web: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
            }
        })
    },
    inner: {
        width: '100%',
        maxWidth: '100%',
        paddingHorizontal: 12, // Уменьшили отступы на мобильных
        paddingVertical: 8,    // Уменьшили вертикальные отступы
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        // Адаптивная высота для разных платформ
        ...Platform.select({
            ios: {
                minHeight: 44,
                paddingTop: (StatusBar.currentHeight || 0) + 8,
            },
            android: {
                minHeight: 48,
                paddingTop: (StatusBar.currentHeight || 0) + 6,
            },
            web: {
                minHeight: 56,
                paddingHorizontal: 16,
                paddingVertical: 10,
            }
        }),
        // Оптимизация для веба
        ...(Platform.OS === 'web' && {
            marginLeft: 'auto',
            marginRight: 'auto',
        }),
    },
});

// Дополнительно: оптимизация для разных размеров экранов
export const getHeaderStyles = (screenWidth: number) => StyleSheet.create({
    adaptiveInner: {
        paddingHorizontal: screenWidth < 375 ? 10 : 12, // Еще меньше отступы на маленьких экранах
        minHeight: screenWidth < 375 ? 42 : Platform.OS === 'web' ? 56 : 44,
    }
});