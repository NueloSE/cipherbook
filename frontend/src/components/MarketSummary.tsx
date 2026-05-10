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
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-white font-mono">{value}</p>
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
      // Reverse so newest is first
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
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
      <h2 className="text-lg font-bold text-white mb-4">
        Market Summary{" "}
        <span className="text-xs font-normal text-gray-500">{BASE_TOKEN_SYMBOL}/{QUOTE_TOKEN_SYMBOL}</span>
      </h2>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700 animate-pulse h-16" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            label={`Last Price (${QUOTE_TOKEN_SYMBOL})`}
            value={formatPrice(summary?.lastTradedPrice ?? 0n)}
          />
          <StatCard
            label={`Volume (${BASE_TOKEN_SYMBOL})`}
            value={summary?.totalVolume === 0n ? "—" : summary?.totalVolume.toString() ?? "—"}
          />
          <StatCard label="Trades" value={summary?.totalTrades.toString() ?? "0"} />
          <StatCard label="Open Orders" value={summary?.openOrders.toString() ?? "0"} />
        </div>
      )}

      {/* Recent trades */}
      <div>
        <p className="text-xs font-semibold text-gray-400 mb-2">Recent Trades</p>
        {trades.length === 0 ? (
          <p className="text-xs text-gray-600">No trades yet.</p>
        ) : (
          <div className="space-y-1">
            {trades.map((t, i) => (
              <div key={i} className="flex justify-between text-xs font-mono">
                <span className="text-emerald-400">{formatPrice(t.price)} {QUOTE_TOKEN_SYMBOL}</span>
                <span className="text-gray-400">{t.qty.toString()} {BASE_TOKEN_SYMBOL}</span>
                <span className="text-gray-600">{formatTime(t.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Open order prices are never revealed — only aggregate stats are public.
      </p>
    </div>
  );
}
