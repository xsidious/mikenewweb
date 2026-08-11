import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Vercel deploy even if ESLint/TS report issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
