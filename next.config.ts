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
};

export default nextConfig;