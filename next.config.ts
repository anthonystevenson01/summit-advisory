import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  compress: true,
  // AI Writing Lab is a separate app (Vercel project llm-lab) built with
  // basePath /AIWritingLab; these rewrites serve it under this domain.
  async rewrites() {
    return [
      {
        source: "/AIWritingLab",
        destination: "https://llm-lab-ten.vercel.app/AIWritingLab",
      },
      {
        source: "/AIWritingLab/:path*",
        destination: "https://llm-lab-ten.vercel.app/AIWritingLab/:path*",
      },
    ];
  },
};

export default nextConfig;
