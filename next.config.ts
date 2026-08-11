import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type-check failures during production builds (Vercel)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
