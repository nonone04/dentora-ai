import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps the on-screen dev route indicator out of `next dev` -- including
  // out of anything captured by scripts/generate-screenshots.mjs, which runs
  // against a dev server for fast iteration.
  devIndicators: false,
  experimental: {
    serverActions: {
      // Default 1mb is too small for the clinic logo upload on the
      // clinic-creation form; client-side validation caps the file
      // itself at 3mb (see components/onboarding/logo-upload-field.tsx),
      // this just leaves room for multipart overhead.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
