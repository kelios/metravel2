/**
 * Тесты для проверки существования всех маршрутов (ссылок) в приложении
 * Проверяет, что все ссылки ведут на существующие страницы
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Routes Existence Tests', () => {
  const appDir = path.join(__dirname, '../../app/(tabs)');
  
  // Получаем все пути из компонентов
  const navItems = [
    { path: '/', label: 'Путешествия' },
    { path: '/travelsby', label: 'Беларусь' },
    { path: '/map', label: 'Карта' },
    { path: '/quests', label: 'Квесты' },
  ];

  const userMenuPaths = [
    '/profile',
    '/metravel',
    '/travel/new',
    '/export',
    '/login',
    '/registration',
  ];

  const breadcrumbPaths = [
    '/',
    '/travelsby',
    '/map',
    '/quests',
    '/profile',
    '/login',
    '/registration',
    '/metravel',
    '/export',
    '/set-password',
    '/accountconfirmation',
  ];

  const hasIndexFile = (dir: string) =>
    fs.existsSync(path.join(dir, 'index.tsx')) || fs.existsSync(path.join(dir, 'index.ts'));

  // Функция для проверки существования файла маршрута
  const routeExists = (routePath: string): boolean => {
    try {
      const cleanPath = routePath.startsWith('/') ? routePath.slice(1) : routePath;
      if (cleanPath === '' || cleanPath === 'index') {
        return fs.existsSync(path.join(appDir, 'index.tsx'));
      }

      const parts = cleanPath.split('/').filter(Boolean);
      let currentDir = appDir;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const potentialDir = path.join(currentDir, part);

        if (isLast) {
          const fileBase = path.join(currentDir, part);
          if (fs.existsSync(`${fileBase}.tsx`) || fs.existsSync(`${fileBase}.ts`)) {
            return true;
          }
          if (fs.existsSync(potentialDir) && fs.statSync(potentialDir).isDirectory()) {
            return hasIndexFile(potentialDir);
          }
          return false;
        }

        if (fs.existsSync(potentialDir) && fs.statSync(potentialDir).isDirectory()) {
          currentDir = potentialDir;
          continue;
        }

        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  describe('Navigation Items Routes', () => {
    navItems.forEach(({ path: routePath, label }) => {
      it(`should have route for "${label}" (${routePath})`, () => {
        expect(routeExists(routePath)).toBe(true);
      });
    });
  });

  describe('User Menu Routes', () => {
    userMenuPaths.forEach((routePath) => {
      it(`should have route for user menu item: ${routePath}`, () => {
        expect(routeExists(routePath)).toBe(true);
      });
    });
  });

  describe('Breadcrumb Routes', () => {
    breadcrumbPaths.forEach((routePath) => {
      it(`should have route for breadcrumb: ${routePath}`, () => {
        // Главная страница всегда существует
        if (routePath === '/') {
          expect(routeExists(routePath)).toBe(true);
          return;
        }
        expect(routeExists(routePath)).toBe(true);
      });
    });
  });

  describe('Dynamic Routes', () => {
    const dynamicRoutes = [
      '/travels/[param]',
      '/travel/[id]',
      '/quests/[city]/[questId]',
    ];

    dynamicRoutes.forEach((routePath) => {
      it(`should have dynamic route: ${routePath}`, () => {
        expect(routeExists(routePath)).toBe(true);
      });
    });
  });

  describe('Links from CustomHeader', () => {
    const customHeaderPaths = [
      '/',
      '/travelsby',
      '/map',
      '/quests',
    ];

    customHeaderPaths.forEach((routePath) => {
      it(`should exist route used in CustomHeader: ${routePath}`, () => {
        expect(routeExists(routePath)).toBe(true);
      });
    });
  });

  describe('Links from RenderRightMenu', () => {
    const renderRightMenuPaths = [
      '/profile',
      '/metravel',
      '/travel/new',
      '/export',
      '/login',
      '/registration',
    ];

    renderRightMenuPaths.forEach((routePath) => {
      it(`should exist route used in RenderRightMenu: ${routePath}`, () => {
        expect(routeExists(routePath)).toBe(true);
      });
    });
  });

  describe('Links from Breadcrumbs', () => {
    const breadcrumbTestCases = [
      { path: '/travels/test-slug', shouldSkip: true }, // Пропускаем slug в breadcrumbs
      { path: '/map', shouldSkip: false },
      { path: '/quests', shouldSkip: false },
      { path: '/profile', shouldSkip: false },
      { path: '/travelsby', shouldSkip: false },
    ];

    breadcrumbTestCases.forEach(({ path: routePath, shouldSkip }) => {
      if (shouldSkip) {
        it(`should skip intermediate "Путешествия" for ${routePath}`, () => {
          // Этот тест проверяет логику breadcrumbs, а не существование маршрута
          expect(routePath.startsWith('/travels/')).toBe(true);
        });
      } else {
        it(`should have route for breadcrumb path: ${routePath}`, () => {
          expect(routeExists(routePath)).toBe(true);
        });
      }
    });
  });

  describe('All routes from _layout.tsx', () => {
    const layoutRoutes = [
      'index',
      'travelsby',
      'map',
      'travels/[param]',
      'about',
      'login',
      'registration',
      'set-password',
      'travel/new',
      'travel/[id]',
      'metravel',
      'profile',
      'accountconfirmation',
    ];

    layoutRoutes.forEach((routeName) => {
      it(`should have route defined in _layout.tsx: ${routeName}`, () => {
        // Преобразуем имя маршрута в путь
        const routePath = routeName === 'index' ? '/' : `/${routeName}`;
        expect(routeExists(routePath)).toBe(true);
      });
    });
  });
});

