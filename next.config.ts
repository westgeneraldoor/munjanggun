import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    serverActions: {
      bodySizeLimit: '128mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/collections/:slug',
        destination: '/:slug',
        permanent: true,
      },
      {
        source: '/colors/:slug',
        destination: '/:slug',
        permanent: true,
      },
    ];
  },
  images: {
    qualities: [75, 85],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cebafroyvmllbyivevjd.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
