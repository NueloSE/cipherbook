"use client";

import { useEffect, useState, useCallback } from "react";
import { getWalletClient, readERC20, writeERC20 } from "@/lib/contract";
import { isUserRejection } from "@/lib/errors";
import { toast } from "@/components/Toast";
import {
  BASE_TOKEN_SYMBOL,
  QUOTE_TOKEN_SYMBOL,
  BASE_TOKEN_DECIMALS,
  QUOTE_TOKEN_DECIMALS,
} from "@/lib/config";

const FAUCET_AMOUNT_BASE = BigInt(1_000) * BigInt(10 ** BASE_TOKEN_DECIMALS);
const FAUCET_AMOUNT_QUOTE = BigInt(10_000) * BigInt(10 ** QUOTE_TOKEN_DECIMALS);

function formatBalance(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${fracStr}`;
}

interface Props {
  account: `0x${string}` | undefined;
  baseTokenAddress: `0x${string}`;
  quoteTokenAddress: `0x${string}`;
}

export default function TokenFaucet({ account, baseTokenAddress, quoteTokenAddress }: Props) {
  const [mounted, setMounted] = useState(false);
  const [baseBalance, setBaseBalance] = useState<bigint>(0n);
  const [quoteBalance, setQuoteBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState<"base" | "quote" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const fetchBalances = useCallback(async () => {
    if (!account) return;
    const [base, quote] = await Promise.all([
      readERC20<bigint>(baseTokenAddress, "balanceOf", [account]),
      readERC20<bigint>(quoteTokenAddress, "balanceOf", [account]),
    ]);
    setBaseBalance(base);
    setQuoteBalance(quote);
  }, [account]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  async function drip(token: "base" | "quote") {
    if (!account) return;
    setError(null);
    setLoading(token);
    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error("No wallet");
      const tokenAddress = token === "base" ? baseTokenAddress : quoteTokenAddress;
      const amount = token === "base" ? FAUCET_AMOUNT_BASE : FAUCET_AMOUNT_QUOTE;
      const hash = await writeERC20(walletClient, tokenAddress, "faucet", [account, amount], account);
      const { getPublicClient } = await import("@/lib/contract");
      const pub = getPublicClient();
      await pub.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      await fetchBalances();
    } catch (e) {
      if (isUserRejection(e)) {
        toast("Transaction cancelled");
        return;
      }
      setError(e instanceof Error ? e.message : "Faucet failed");
    } finally {
      setLoading(null);
    }
  }

  const placeholder = (
    <div className="card p-5">
      <h2 className="text-sm font-bold text-white mb-4 font-mono uppercase tracking-widest">Token Faucet</h2>
    </div>
  );

  if (!mounted) return placeholder;

  if (!account) return (
    <div className="card p-5">
      <h2 className="text-sm font-bold text-white mb-4 font-mono uppercase tracking-widest">Token Faucet</h2>
      <p className="text-sm text-white/30 font-mono">Connect your wallet to use the faucet.</p>
    </div>
  );

  return (
    <div className="card p-5">
      <h2 className="text-sm font-bold text-white mb-4 font-mono uppercase tracking-widest">Token Faucet</h2>

      {error && (
        <div className="mb-3 text-xs text-[#ff4757] card-inner border border-[#ff4757]/30 rounded-xl px-3 py-2 font-mono">
          {error}
        </div>
      )}

      <div className="space-y-2.5">
        {(
          [
            {
              key: "base" as const,
              symbol: BASE_TOKEN_SYMBOL,
              balance: baseBalance,
              decimals: BASE_TOKEN_DECIMALS,
              dripAmount: "1,000",
            },
            {
              key: "quote" as const,
              symbol: QUOTE_TOKEN_SYMBOL,
              balance: quoteBalance,
              decimals: QUOTE_TOKEN_DECIMALS,
              dripAmount: "10,000",
            },
          ] as const
        ).map(({ key, symbol, balance, decimals, dripAmount }) => (
          <div
            key={key}
            className="flex items-center justify-between card-inner px-4 py-3"
          >
            <div>
              <p className="data-label mb-1">{symbol} Balance</p>
              <p className="text-white font-mono text-sm tabular">
                {formatBalance(balance, decimals)}{" "}
                <span className="text-[#00f0ff]/50 text-xs">{symbol}</span>
              </p>
            </div>
            <button
              onClick={() => drip(key)}
              disabled={!!loading}
              className="btn-app text-xs px-3 py-1.5 rounded-lg disabled:opacity-40 font-mono"
            >
              {loading === key ? "Minting…" : `Get ${dripAmount}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
