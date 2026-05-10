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
    <div className="bg-[#0f111a] rounded-xl p-6 border border-[#1a1f35] hover:border-[#252c48] transition-colors">
      <h2 className="text-base font-bold text-[#e2e8f0] mb-1 font-mono tracking-wide">
        Matching Engine
      </h2>
      <p className="text-xs text-[#4a5578] mb-4 leading-relaxed">
        Runs encrypted batch matching across all open orders. Anyone can trigger this.
      </p>

      <button
        onClick={handleRun}
        disabled={!mounted || status === "pending" || !isConnected}
        suppressHydrationWarning
        className={`w-full py-3 rounded-lg text-sm font-bold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed
          ${status === "done"
            ? "bg-[#003d28] border border-[#00ff9d]/50 text-[#00ff9d]"
            : status === "error"
              ? "bg-[#3d0015] border border-[#ff3b6b]/50 text-[#ff3b6b]"
              : "bg-[#00f0ff]/10 border border-[#00f0ff]/40 text-[#00f0ff] hover:bg-[#00f0ff]/20 hover:border-[#00f0ff]/70"
          }`}
      >
        {status === "pending"
          ? "Running Batch Match…"
          : status === "done"
            ? "Match Complete"
            : status === "error"
              ? "Transaction Failed"
              : "Run Batch Match"}
      </button>

      {status === "done" && lastTxHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center text-xs text-[#00f0ff]/60 hover:text-[#00f0ff] transition-colors font-mono"
        >
          View on Etherscan ↗
        </a>
      )}

      {mounted && !isConnected && (
        <p className="mt-2 text-xs text-[#4a5578] text-center font-mono">Connect wallet to trigger matching</p>
      )}
    </div>
  );
}
