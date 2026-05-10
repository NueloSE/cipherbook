"use client";

import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";

let instance: FhevmInstance | null = null;

export async function getFhevmInstance(): Promise<FhevmInstance> {
  if (instance) return instance;

  const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");

  // Initialize WASM modules from the static assets served under /public/wasm/.
  await initSDK({
    tfheParams: "/wasm/tfhe_bg.wasm",
    kmsParams: "/wasm/kms_lib_bg.wasm",
  });

  // Use a public Sepolia RPC (not window.ethereum) for ACL state reads inside the SDK.
  // MetaMask's injected provider can be on a different chain or rate-limited.
  instance = await createInstance({
    ...SepoliaConfig,
    network: "https://ethereum-sepolia-rpc.publicnode.com",
  });

  return instance;
}

export function resetFhevmInstance() {
  instance = null;
}
