import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // The capture-guide screenshots live outside public/ (they're staff-only, served
  // by app/guide/capture/shots/[name]) — standalone won't trace files it can't see
  // being imported, so include them explicitly or they vanish on Railway.
  outputFileTracingIncludes: {
    '/guide/capture/shots/[name]': ['./guide-shots/**'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gzssbicdblkmllutegju.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
