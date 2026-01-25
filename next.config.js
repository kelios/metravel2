/** @type {import('next').NextConfig} */
const nextConfig = {
  // Оптимизация изображений
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [420, 640, 750, 860, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 год
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Компрессия
  compress: true,
  
  // Оптимизация production сборки
  swcMinify: true,
  
  // Оптимизация производительности
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Headers для кеширования
  async headers() {
    return [
      {
        source: '/:path*.(jpg|jpeg|png|gif|webp|avif|svg|ico|woff2|woff|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*.(css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000',
          },
        ],
      },
    ]
  },
  
  // Экспериментальные функции для производительности
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['react-native-paper', '@expo/vector-icons'],
    scrollRestoration: true,
  },
  
  // Оптимизация модулей
  modularizeImports: {
    '@expo/vector-icons': {
      transform: '@expo/vector-icons/{{member}}',
    },
  },
}

module.exports = nextConfig





