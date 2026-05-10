"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => setMounted(true), []);

  // If isPending clears (success or error), reset timeout flag
  useEffect(() => {
    if (!isPending) setTimedOut(false);
  }, [isPending]);

  if (!mounted) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-indigo-600 opacity-50 cursor-not-allowed text-white text-sm font-semibold rounded-lg"
      >
        Connect Wallet
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 font-mono">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const connector = connectors[0];
  const hasWallet = typeof window !== "undefined" && !!window.ethereum;

  if (!hasWallet) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          disabled
          className="px-4 py-2 bg-indigo-600 opacity-50 cursor-not-allowed text-white text-sm font-semibold rounded-lg"
        >
          Connect Wallet
        </button>
        <span className="text-xs text-gray-500">
          Install{" "}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 underline"
          >
            MetaMask
          </a>{" "}
          to continue
        </span>
      </div>
    );
  }

  const handleConnect = () => {
    setTimedOut(false);
    const watchdog = setTimeout(() => setTimedOut(true), 15_000);
    connect({ connector }, { onSettled: () => clearTimeout(watchdog) });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleConnect}
        disabled={isPending}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
      {timedOut && (
        <span className="text-xs text-amber-400">
          Check your MetaMask popup — it may be hidden behind this window
        </span>
      )}
      {error && <span className="text-xs text-rose-400">{error.message}</span>}
    </div>
  );
}
