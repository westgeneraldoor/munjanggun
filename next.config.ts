import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
