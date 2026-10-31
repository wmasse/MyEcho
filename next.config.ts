import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image-cdn-fa.spotifycdn.com",
        pathname: "/image/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "image-cdn-ak.spotifycdn.com",
        pathname: "/image/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.mzstatic.com",
        pathname: "/image/**",
        search: "",
      },
    ],
  },

  experimental: {
    agentFeedback: true,
  },

  cacheComponents: true,

  partialPrefetching: true,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
