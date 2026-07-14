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
      {
        // Jaquettes fournies par le catalogue Deezer lorsque l'on choisit un
        // album dans l'assistant de proposition.
        protocol: "https",
        hostname: "cdn-images.dzcdn.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
