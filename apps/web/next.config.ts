import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@credora/shared',
    '@credora/credential-core',
    '@credora/contracts',
    '@credora/blockchain',
    '@credora/storage',
    '@credora/auth',
    '@credora/ui',
  ],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  async headers() {
    return [
      {
        source: '/share/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
