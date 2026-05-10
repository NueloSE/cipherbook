"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { writeContract } from "@/lib/contract";
import { isUserRejection } from "@/lib/errors";
import { toast } from "@/components/Toast";

export function BatchMatch({ onMatchRun, contractAddress }: { onMatchRun?: () => void; contractAddress: `0x${string}` }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [lastTxHash, setLastTxHash] = useState<string>("");

  const handleRun = async () => {
    if (!address || !walletClient) return;
    setStatus("pending");
    try {
      const hash = await writeContract(walletClient, "runBatchMatch", [], address, contractAddress);
      setLastTxHash(hash);
      setStatus("done");
      onMatchRun?.();
      setTimeout(() => setStatus("idle"), 5000);
    } catch (e) {
      if (isUserRejection(e)) {
        toast("Transaction cancelled");
        setStatus("idle");
        return;
      }
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-bold text-white mb-1 font-mono uppercase tracking-widest">
        Matching Engine
      </h2>
      <p className="text-xs text-white/25 mb-4 leading-relaxed font-mono">
        Runs FHE batch matching across all open orders. Anyone can trigger this.
      </p>

      <button
        onClick={handleRun}
        disabled={!mounted || status === "pending" || !isConnected}
        suppressHydrationWarning
        className={`w-full py-2.5 rounded-xl text-sm font-bold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed
          ${status === "done"
            ? "btn-buy active"
            : status === "error"
              ? "btn-sell"
              : "btn-app"
          }`}
      >
        {status === "pending"
          ? "Running Batch Match…"
          : status === "done"
            ? "Match Complete ✓"
            : status === "error"
              ? "Transaction Failed"
              : "Run Batch Match"}
      </button>

      {status === "done" && lastTxHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center text-xs text-[#00f0ff]/40 hover:text-[#00f0ff]/80 transition-colors font-mono"
        >
          View on Etherscan ↗
        </a>
      )}

      {mounted && !isConnected && (
        <p className="mt-2 text-xs text-white/20 text-center font-mono">Connect wallet to trigger matching</p>
      )}
    </div>
  );
}
