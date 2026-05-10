"use client";

import { useEffect, useState, useCallback } from "react";
import { getPublicClient, CIPHERBOOK_ABI } from "@/lib/contract";
import { BASE_TOKEN_SYMBOL, QUOTE_TOKEN_SYMBOL, QUOTE_TOKEN_DECIMALS } from "@/lib/config";

type Summary = {
  lastTradedPrice: bigint;
  totalVolume: bigint;
  totalTrades: bigint;
  openOrders: bigint;
};

type TradeRecord = {
  qty: bigint;
  price: bigint;
  timestamp: bigint;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#141622] rounded-lg p-4 border border-[#1a1f35]">
      <p className="text-xs text-[#4a5578] mb-1 font-mono uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-[#e2e8f0] font-mono">{value}</p>
    </div>
  );
}

function formatPrice(raw: bigint): string {
  if (raw === 0n) return "—";
  return (Number(raw) / 10 ** QUOTE_TOKEN_DECIMALS).toFixed(2);
}

function formatTime(ts: bigint): string {
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function MarketSummary({ refreshTrigger, contractAddress }: { refreshTrigger?: number; contractAddress: `0x${string}` }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const client = getPublicClient();
      const [rawSummary, rawTrades] = await Promise.all([
        client.readContract({
          address: contractAddress,
          abi: CIPHERBOOK_ABI,
          functionName: "getMarketSummary",
        }) as Promise<[bigint, bigint, bigint, bigint]>,
        client.readContract({
          address: contractAddress,
          abi: CIPHERBOOK_ABI,
          functionName: "getRecentTrades",
        }) as Promise<TradeRecord[]>,
      ]);

      const [lastTradedPrice, totalVolume, totalTrades, openOrders] = rawSummary;
      setSummary({ lastTradedPrice, totalVolume, totalTrades, openOrders });
      setTrades([...rawTrades].reverse());
    } catch {
      // keep stale data on RPC error
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  return (
    <div className="bg-[#0f111a] rounded-xl p-6 border border-[#1a1f35] hover:border-[#252c48] transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-bold text-[#e2e8f0] font-mono tracking-wide">Market</h2>
        <span className="text-xs text-[#00f0ff]/60 font-mono">{BASE_TOKEN_SYMBOL}/{QUOTE_TOKEN_SYMBOL}</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#141622] rounded-lg p-4 border border-[#1a1f35] animate-pulse h-16" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label={`Last Price`}
            value={formatPrice(summary?.lastTradedPrice ?? 0n)}
          />
          <StatCard
            label={`Volume`}
            value={summary?.totalVolume === 0n ? "—" : (summary?.totalVolume.toString() ?? "—")}
          />
          <StatCard label="Trades" value={summary?.totalTrades.toString() ?? "0"} />
          <StatCard label="Open Orders" value={summary?.openOrders.toString() ?? "0"} />
        </div>
      )}

      <div>
        <p className="text-xs font-mono text-[#4a5578] mb-2 uppercase tracking-wider">Recent Trades</p>
        {trades.length === 0 ? (
          <p className="text-xs text-[#374060] font-mono">No trades yet.</p>
        ) : (
          <div className="space-y-1.5">
            {trades.map((t, i) => (
              <div key={i} className="flex justify-between text-xs font-mono bg-[#141622]/60 rounded px-2 py-1">
                <span className="text-[#00ff9d]">{formatPrice(t.price)} {QUOTE_TOKEN_SYMBOL}</span>
                <span className="text-[#8892b0]">{t.qty.toString()} {BASE_TOKEN_SYMBOL}</span>
                <span className="text-[#374060]">{formatTime(t.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-[#374060] font-mono">
        Open order prices never revealed — only aggregate stats are public.
      </p>
    </div>
  );
}
