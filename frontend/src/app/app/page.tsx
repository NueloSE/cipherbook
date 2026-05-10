"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CipherBookIcon } from "@/components/CipherBookIcon";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { PlaceOrder } from "@/components/PlaceOrder";
import { MyOrders } from "@/components/MyOrders";
import { MarketSummary } from "@/components/MarketSummary";
import { BatchMatch } from "@/components/BatchMatch";
import TokenFaucet from "@/components/TokenFaucet";
import PendingSettlements from "@/components/PendingSettlements";
import PairSelector from "@/components/PairSelector";
import { Toaster } from "@/components/Toast";
import { getPublicClient, CIPHERBOOK_ABI } from "@/lib/contract";
import {
  BASE_TOKEN_SYMBOL,
  QUOTE_TOKEN_SYMBOL,
  CONTRACT_ADDRESS,
  BASE_TOKEN_ADDRESS,
  QUOTE_TOKEN_ADDRESS,
} from "@/lib/config";

export default function AppPage() {
  const { address } = useAccount();
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedPair, setSelectedPair] = useState<`0x${string}`>(CONTRACT_ADDRESS as `0x${string}`);
  const [pairBaseToken, setPairBaseToken] = useState<`0x${string}`>(BASE_TOKEN_ADDRESS as `0x${string}`);
  const [pairQuoteToken, setPairQuoteToken] = useState<`0x${string}`>(QUOTE_TOKEN_ADDRESS as `0x${string}`);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    async function fetchTokens() {
      try {
        const client = getPublicClient();
        const [base, quote] = await Promise.all([
          client.readContract({
            address: selectedPair,
            abi: CIPHERBOOK_ABI,
            functionName: "baseToken",
          }) as Promise<`0x${string}`>,
          client.readContract({
            address: selectedPair,
            abi: CIPHERBOOK_ABI,
            functionName: "quoteToken",
          }) as Promise<`0x${string}`>,
        ]);
        setPairBaseToken(base);
        setPairQuoteToken(quote);
      } catch {
        // keep defaults on error
      }
    }
    fetchTokens();
  }, [selectedPair]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#020408]/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 hover:opacity-75 transition-opacity shrink-0">
              <CipherBookIcon size={24} />
              <span className="font-bold text-white tracking-wide text-sm hidden sm:block">CipherBook</span>
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 card-inner rounded-lg">
              <div className="flex items-center -space-x-1.5">
                <div className="w-5 h-5 rounded-full bg-[#0047cc] border-2 border-[#020408] flex items-center justify-center text-[9px] font-black text-white">T</div>
                <div className="w-5 h-5 rounded-full bg-[#00804a] border-2 border-[#020408] flex items-center justify-center text-[9px] font-black text-white">Q</div>
              </div>
              <span className="text-sm font-bold text-white font-mono">{BASE_TOKEN_SYMBOL}/{QUOTE_TOKEN_SYMBOL}</span>
              <span className="text-xs text-white/20 font-mono">Sepolia</span>
            </div>
            <div className="hidden md:block">
              <PairSelector selected={selectedPair} onSelect={setSelectedPair} />
            </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* FHE status bar */}
      <div className="border-b border-white/5" style={{ background: "rgba(0,240,255,0.02)" }}>
        <div className="max-w-6xl mx-auto px-5 py-2 flex flex-wrap gap-5">
          {([
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ),
              text: "Prices FHE-encrypted on-chain",
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ),
              text: "MEV bots cannot read your price",
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              ),
              text: "Permissionless matching · Trustless settlement",
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              ),
              text: "Sign to decrypt your own orders",
            },
          ] as { icon: React.ReactNode; text: string }[]).map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-white/20 font-mono">
              <span className="text-[#00f0ff]/40">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-5 py-6 space-y-5">
        {/* Pair header */}
        <div className="flex items-center gap-3 px-1">
          <h1 className="text-xl font-black text-white font-mono tracking-tight">{BASE_TOKEN_SYMBOL} / {QUOTE_TOKEN_SYMBOL}</h1>
          <span className="text-xs text-white/30 card-inner px-2 py-0.5 rounded font-mono">Sepolia</span>
          <span className="text-xs text-white/15 hidden sm:block font-mono">
            Prices in {QUOTE_TOKEN_SYMBOL} · Amounts in {BASE_TOKEN_SYMBOL}
          </span>
        </div>

        {/* Top row — 3 cols */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MarketSummary refreshTrigger={refreshTick} contractAddress={selectedPair} />
          <PlaceOrder
            onOrderPlaced={refresh}
            contractAddress={selectedPair}
            baseTokenAddress={pairBaseToken}
            quoteTokenAddress={pairQuoteToken}
          />
          <div className="flex flex-col gap-4">
            <BatchMatch onMatchRun={refresh} contractAddress={selectedPair} />
            {/* How to trade */}
            <div className="card p-4 text-xs text-white/30 space-y-2 font-mono">
              <p className="font-semibold text-white/50 text-[11px] uppercase tracking-widest mb-3">How to trade</p>
              {[
                ["01", "Get test tokens from the faucet below."],
                ["02", "Place a limit order — price FHE-encrypted, tokens escrowed."],
                ["03", "Click Run Batch Match — encrypted comparison runs on-chain."],
                ["04", "KMS relayer auto-settles. Check Pending Settlements if needed."],
                ["05", "View My Orders — sign to decrypt prices and withdraw escrow."],
              ].map(([n, text]) => (
                <p key={n}>
                  <span className="text-[#00f0ff]/30">{n}</span>{"  "}{text}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Faucet + Pending */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TokenFaucet
            account={address}
            baseTokenAddress={pairBaseToken}
            quoteTokenAddress={pairQuoteToken}
          />
          <PendingSettlements onSettled={refresh} contractAddress={selectedPair} />
        </div>

        {/* Orders */}
        <MyOrders refreshTrigger={refreshTick} contractAddress={selectedPair} />
      </main>

      <Toaster />

      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between text-xs text-white/15 font-mono">
          <span>CipherBook · Zama Developer Program Season 2 · fhEVM v0.11</span>
          <a
            href={`https://sepolia.etherscan.io/address/${selectedPair}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#00f0ff]/40 transition-colors"
          >
            {selectedPair.slice(0, 6)}…{selectedPair.slice(-4)} ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
