/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove X-Powered-By header
  poweredByHeader: false,

  // Gzip/Brotli compression — 60-80% smaller responses
  compress: true,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.facebook.com' },
    ],
    formats: ['image/webp'],
  },

  compiler: {
    // Strip console.log in production builds
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  experimental: {
    // Tree-shake lucide-react — only bundle icons actually used
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
