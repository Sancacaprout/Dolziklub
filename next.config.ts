import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 90, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kcizszuvrtnlxgikgfdx.supabase.co",
        pathname: "/storage/v1/object/public/meme-uploads/**",
      },
      {
        protocol: "https",
        hostname: "kcizszuvrtnlxgikgfdx.supabase.co",
        pathname: "/storage/v1/object/public/member-avatars/**",
      },
      {
        protocol: "https",
        hostname: "kcizszuvrtnlxgikgfdx.supabase.co",
        pathname: "/storage/v1/object/public/album-covers/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
