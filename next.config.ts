import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Cookies are host-only and SameSite, so the browser calls the API on the app's own host and Next forwards
  // /api/v1/* to the backend. Set API_ORIGIN in each environment (default: local backend).
  async rewrites() {
    const api = process.env.API_ORIGIN ?? 'http://localhost:4000';
    return [{ source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` }];
  },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default nextConfig;
