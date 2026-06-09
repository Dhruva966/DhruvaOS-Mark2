import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/content/:path*",
        destination: "https://web-eta-two-78.vercel.app/:path*",
      },
      {
        source: "/jarvis/:path*",
        destination: "https://jarvis-voice-umber.vercel.app/:path*",
      },
    ];
  },
};

export default nextConfig;
