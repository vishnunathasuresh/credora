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
};

export default nextConfig;
