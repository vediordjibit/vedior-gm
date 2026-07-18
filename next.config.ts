import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/admin", destination: "/" },
      { source: "/admin/:path*", destination: "/" },
      { source: "/recruiter", destination: "/" },
      { source: "/recruiter/:path*", destination: "/" },
      { source: "/candidate", destination: "/" },
      { source: "/candidate/:path*", destination: "/" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;