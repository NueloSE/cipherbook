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

  // When pair changes, read its token addresses from the contract
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <CipherBookIcon size={28} />
              <span className="font-bold text-white">CipherBook</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center -space-x-1.5">
                <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-gray-800 flex items-center justify-center text-[9px] font-bold">T</div>
                <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-gray-800 flex items-center justify-center text-[9px] font-bold">Q</div>
              </div>
              <span className="text-sm font-bold text-white">{BASE_TOKEN_SYMBOL} / {QUOTE_TOKEN_SYMBOL}</span>
              <span className="text-xs text-gray-500">Sepolia</span>
            </div>
            <PairSelector selected={selectedPair} onSelect={setSelectedPair} />
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* FHE status bar */}
      <div className="border-b border-gray-800 bg-indigo-950/20">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap gap-4">
          {([
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ),
              text: "All order prices FHE-encrypted on-chain",
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ),
              text: "MEV bots cannot see your price",
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              ),
              text: "Permissionless batch matching + trustless settlement",
            },
            {
              icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              ),
              text: "Click Decrypt & Load to refresh your orders",
            },
          ] as { icon: React.ReactNode; text: string }[]).map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="text-indigo-400">{icon}</span><span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Pair info row */}
        <div className="flex items-center gap-3 px-1">
          <h1 className="text-xl font-bold text-white">{BASE_TOKEN_SYMBOL} / {QUOTE_TOKEN_SYMBOL}</h1>
          <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded">
            Sepolia Testnet
          </span>
          <span className="text-xs text-gray-600 hidden sm:block">
            Prices in {QUOTE_TOKEN_SYMBOL} · Amounts in {BASE_TOKEN_SYMBOL}
          </span>
        </div>

        {/* Top row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <MarketSummary refreshTrigger={refreshTick} contractAddress={selectedPair} />
          </div>
          <div className="lg:col-span-1">
            <PlaceOrder
              onOrderPlaced={refresh}
              contractAddress={selectedPair}
              baseTokenAddress={pairBaseToken}
              quoteTokenAddress={pairQuoteToken}
            />
          </div>
          <div className="lg:col-span-1 flex flex-col gap-4">
            <BatchMatch onMatchRun={refresh} contractAddress={selectedPair} />
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-xs text-gray-500 space-y-2">
              <p className="font-semibold text-gray-400">How to trade</p>
              <p>1. Get test tokens from the faucet below.</p>
              <p>2. Place a limit order — price is FHE-encrypted; tokens are escrowed into the contract.</p>
              <p>3. Click Run Batch Match — encrypted prices are compared on-chain without decryption.</p>
              <p>4. The KMS relayer auto-settles matched pairs. Check Pending Settlements if not.</p>
              <p>5. View My Orders — sign to decrypt your price and withdraw any unused escrow.</p>
            </div>
          </div>
        </div>

        {/* Faucet + Pending Settlements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TokenFaucet
            account={address}
            baseTokenAddress={pairBaseToken}
            quoteTokenAddress={pairQuoteToken}
          />
          <PendingSettlements onSettled={refresh} contractAddress={selectedPair} />
        </div>

        {/* Orders table */}
        <MyOrders refreshTrigger={refreshTick} contractAddress={selectedPair} />
      </main>

      <Toaster />

      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-gray-600">
          <span>CipherBook · Zama Developer Program Season 2 · Built with fhEVM v0.11</span>
          <a
            href={`https://sepolia.etherscan.io/address/${selectedPair}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-400 transition-colors font-mono"
          >
            {selectedPair.slice(0, 6)}…{selectedPair.slice(-4)} ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
