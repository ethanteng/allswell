import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint is a separate CI step; a lint error shouldn't fail a Vercel deploy.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
