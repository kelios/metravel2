/** @type {import('next').NextConfig} */
const nextConfig = {
  // Оптимизация изображений
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 год
  },
  
  // Компрессия
  compress: true,
  
  // Оптимизация production сборки
  swcMinify: true,
  
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
  },
}

module.exports = nextConfig

