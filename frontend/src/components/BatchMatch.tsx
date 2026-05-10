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
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
      <h2 className="text-lg font-bold text-white mb-1">Matching Engine</h2>
      <p className="text-xs text-gray-500 mb-4">
        Runs encrypted batch matching across all open orders. Anyone can trigger this — in production
        it would be automated by a keeper.
      </p>

      <button
        onClick={handleRun}
        disabled={!mounted || status === "pending" || !isConnected}
        suppressHydrationWarning
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
      >
        {status === "pending"
          ? "Running Batch Match…"
          : status === "done"
            ? "Match Complete!"
            : status === "error"
              ? "Transaction Failed"
              : "Run Batch Match"}
      </button>

      {status === "done" && lastTxHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View on Etherscan →
        </a>
      )}

      {mounted && !isConnected && (
        <p className="mt-2 text-xs text-gray-500 text-center">Connect wallet to trigger matching</p>
      )}
    </div>
  );
}
