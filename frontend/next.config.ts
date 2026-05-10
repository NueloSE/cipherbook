import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },

  transpilePackages: ["wagmi", "@wagmi/core", "@wagmi/connectors"],

  serverExternalPackages: ["@zama-fhe/relayer-sdk"],

  webpack: (config) => {
    // @wagmi/core's tempo/Connectors.js does `await import('accounts').catch()`
    // for the optional Tempo Wallet. We don't use it — alias to false so webpack
    // treats it as an empty module and the .catch() handles it at runtime.
    config.resolve.alias = {
      ...config.resolve.alias,
      accounts: false,
    };
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
