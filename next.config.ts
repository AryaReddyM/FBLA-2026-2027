import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The demo and the real school are separate Supabase projects. Their public
  // keys are baked into the build, so each gets its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Cache Components: pages render a static shell instantly and stream the
  // signed-in, per-user parts behind <Suspense> boundaries.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Asset photos (≤ 2 MB after compression) and CSV imports go through
      // Server Actions; the default 1 MB limit is too small for them.
      bodySizeLimit: "4mb",
    },
  },
  // PDF generation uses Node APIs (fonts, streams); load it at runtime instead of bundling.
  serverExternalPackages: ["@react-pdf/renderer"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
