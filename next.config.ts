import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kcizszuvrtnlxgikgfdx.supabase.co",
        pathname: "/storage/v1/object/public/meme-uploads/**",
      },
    ],
  },
};

export default nextConfig;
