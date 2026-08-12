import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Must stay >= the largest per-action file-size cap (lot documents /
      // site plans allow up to 20MB) — otherwise Next.js silently rejects
      // the request before it reaches the action's own validation, which
      // showed up as site plan PDF uploads (often large iPad scans) failing
      // well under their advertised 20MB limit.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
