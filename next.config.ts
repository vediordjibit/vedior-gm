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
        // Page candidate — désactiver COOP pour permettre le popup Google Auth
        source: "/candidate(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "unsafe-none" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
      {
        // Toutes les autres pages
        source: "/((?!candidate).*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
        ],
      },
    ];
  },
};

export default nextConfig;