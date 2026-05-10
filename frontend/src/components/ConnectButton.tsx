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

  useEffect(() => {
    if (!isPending) setTimedOut(false);
  }, [isPending]);

  if (!mounted) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-[#00f0ff]/10 border border-[#00f0ff]/30 opacity-50 cursor-not-allowed text-[#00f0ff] text-sm font-mono rounded-lg"
      >
        Connect Wallet
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-[#0f111a] border border-[#1a1f35] rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse shrink-0" />
          <span className="text-xs sm:text-sm text-[#00f0ff] font-mono">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </div>
        {/* Desktop: text button */}
        <button
          onClick={() => disconnect()}
          className="hidden sm:block px-3 py-1.5 text-xs rounded-lg border border-[#1a1f35] text-[#4a5578] hover:border-[#252c48] hover:text-[#8892b0] transition-all font-mono"
        >
          Disconnect
        </button>
        {/* Mobile: icon-only button */}
        <button
          onClick={() => disconnect()}
          title="Disconnect"
          className="sm:hidden p-1.5 rounded-lg border border-[#1a1f35] text-[#4a5578] hover:border-[#252c48] hover:text-[#8892b0] transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
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
          className="px-4 py-2 bg-[#00f0ff]/10 border border-[#00f0ff]/30 opacity-50 cursor-not-allowed text-[#00f0ff] text-sm font-mono rounded-lg"
        >
          Connect Wallet
        </button>
        <span className="text-xs text-[#4a5578]">
          Install{" "}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
            className="text-[#00f0ff]/70 hover:text-[#00f0ff] underline transition-colors"
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
        className="px-3 sm:px-4 py-2 bg-[#00f0ff]/10 border border-[#00f0ff]/40 hover:bg-[#00f0ff]/20 hover:border-[#00f0ff]/70 disabled:opacity-50 disabled:cursor-not-allowed text-[#00f0ff] text-xs sm:text-sm font-mono rounded-lg transition-all whitespace-nowrap"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
      {timedOut && (
        <span className="text-xs text-amber-400 font-mono">
          Check MetaMask — popup may be hidden
        </span>
      )}
      {error && <span className="text-xs text-[#ff3b6b] font-mono">{error.message}</span>}
    </div>
  );
}
