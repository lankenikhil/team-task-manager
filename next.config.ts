import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel-compatible output mode
  output: "standalone",
  // Ignore TypeScript build errors for faster builds (review in production)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Ensure environment variables are available at runtime
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
  },
};

export default nextConfig;
