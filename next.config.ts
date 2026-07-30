import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
