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
  // The homepage SPA no longer has a Scale-Up Advisory view; the practice has
  // its own hub page, so old ?page=sme deep links land there. Nothing on the
  // site links to /?page=sme any more; this is for bookmarks and external
  // links. It lives here rather than in the SPA's mount effect so it is a real
  // 308 (cached by browsers, no homepage flash, works without JS) and can be
  // unit-tested. Next merges the incoming query into the destination, so the
  // landing URL is /scale-up-advisory?page=sme; the hub is static and ignores
  // it. Other ?page values are untouched. Keep this file to `import type`
  // only: the test suite loads it under Node's type stripping.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "page", value: "sme" }],
        destination: "/scale-up-advisory",
        permanent: true,
      },
      // The Project Builder moved from /tools/project-builder to
      // /project-builder in October 2026. Permanent (308) because the old
      // address is retired: search engines move the listing across and
      // browsers cache the hop. Resume links already emailed (?b=&t=) and
      // shared ?src= tags point at the old address; they work only because
      // Next carries the incoming query to the destination, where the page
      // reads b, t and src on the client. Keep the entry unconditional (no
      // `has` or `missing`) so every old link is caught. Do not remove it
      // without a migration: those links stay in inboxes. Do not reuse
      // /tools/project-builder either, as browsers that cached the 308 never
      // request it again. The destination must equal PROJECT_BUILDER_PATH
      // (asserted in __tests__/project-builder-path.test.ts); it is a literal
      // because this file may only `import type`.
      {
        source: "/tools/project-builder",
        destination: "/project-builder",
        permanent: true,
      },
    ];
  },
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
