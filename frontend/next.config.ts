import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 enables Turbopack by default — declare it explicitly to
  // silence the "webpack config with no turbopack config" build error.
  turbopack: {},

  // Fallback webpack config for non-Turbopack builds (tests, older tooling).
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },

  // Required for SharedArrayBuffer (WASM multithreading in @zama-fhe/relayer-sdk).
  // require-corp is needed for Firefox — credentialless doesn't propagate
  // crossOriginIsolated into WebWorkers in Firefox.
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
