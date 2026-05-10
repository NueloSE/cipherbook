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
      <button disabled className="btn-app px-4 py-2 rounded-lg text-sm font-mono opacity-50 cursor-not-allowed">
        Connect Wallet
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 card-inner rounded-lg">
          <span className="dot-live shrink-0" style={{ width: 6, height: 6 }} />
          <span className="text-xs text-[#00f0ff]/80 font-mono">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="hidden sm:block btn-app px-3 py-1.5 text-xs rounded-lg font-mono"
        >
          Disconnect
        </button>
        <button
          onClick={() => disconnect()}
          title="Disconnect"
          className="sm:hidden btn-app p-1.5 rounded-lg"
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
        <button disabled className="btn-app px-4 py-2 rounded-lg text-sm font-mono opacity-40 cursor-not-allowed">
          Connect Wallet
        </button>
        <span className="text-[10px] text-white/25 font-mono">
          Install{" "}
          <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="text-[#00f0ff]/50 hover:text-[#00f0ff]/80 transition-colors">
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
        className="btn-cyan px-4 py-2 rounded-lg text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
      {timedOut && (
        <span className="text-[10px] text-amber-400/70 font-mono">Check MetaMask — popup may be hidden</span>
      )}
      {error && <span className="text-[10px] text-[#ff4757]/80 font-mono">{error.message}</span>}
    </div>
  );
}
