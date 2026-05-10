import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip type-checking during production build — major speedup on Vercel's
  // low-resource machines. Type errors are caught in local dev / CI instead.
  typescript: { ignoreBuildErrors: true },

  // Keep the Zama relayer SDK out of the SSR bundle — it is browser-only.
  serverExternalPackages: ["@zama-fhe/relayer-sdk"],

  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
