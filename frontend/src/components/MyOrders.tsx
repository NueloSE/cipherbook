"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { getFhevmInstance } from "@/lib/fhevm";
import { readContract, writeContract } from "@/lib/contract";
import { isUserRejection } from "@/lib/errors";
import { toast } from "@/components/Toast";
import {
  ORDER_STATUS_LABEL,
  OrderSide,
  OrderStatus,
  BASE_TOKEN_SYMBOL,
  QUOTE_TOKEN_SYMBOL,
  QUOTE_TOKEN_DECIMALS,
} from "@/lib/config";

type RawOrder = {
  id: bigint;
  owner: `0x${string}`;
  side: number;
  encryptedPrice: `0x${string}`;
  amount: bigint;
  remainingAmount: bigint;
  escrowedTokens: bigint;
  status: number;
  timestamp: bigint;
};

type DecryptedOrder = RawOrder & { price: bigint };

type LoadState = "idle" | "fetching" | "signing" | "decrypting" | "rejected";

function formatEscrow(raw: bigint, side: number): string {
  if (side === OrderSide.SELL) {
    return `${raw.toString()} ${BASE_TOKEN_SYMBOL}`;
  }
  const divisor = BigInt(10 ** QUOTE_TOKEN_DECIMALS);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(QUOTE_TOKEN_DECIMALS, "0").slice(0, 2);
  return `${whole}.${frac} ${QUOTE_TOKEN_SYMBOL}`;
}

export function MyOrders({ refreshTrigger, contractAddress }: { refreshTrigger?: number; contractAddress: `0x${string}` }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<DecryptedOrder[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [cancellingId, setCancellingId] = useState<bigint | null>(null);
  const [markFilledId, setMarkFilledId] = useState<bigint | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<bigint | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadOrders = useCallback(async () => {
    if (!address || !isConnected) return;
    setHasLoaded(true);
    setLoadState("fetching");

    try {
      const ids = await readContract<bigint[]>("getMyOrderIds", [], address, contractAddress);
      if (ids.length === 0) {
        setOrders([]);
        setLoadState("idle");
        return;
      }

      const rawOrders = await Promise.all(
        ids.map((id) => readContract<RawOrder>("getMyOrder", [id], address, contractAddress))
      );

      const fhevm = await getFhevmInstance();
      const { publicKey, privateKey } = fhevm.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1;
      const eip712 = fhevm.createEIP712(publicKey, [contractAddress], startTimestamp, durationDays);

      setLoadState("signing");
      let signature: string;
      try {
        signature = (await window.ethereum!.request({
          method: "eth_signTypedData_v4",
          params: [address, JSON.stringify(eip712, (_k, v) => (typeof v === "bigint" ? v.toString() : v))],
        })) as string;
      } catch {
        setLoadState("rejected");
        return;
      }

      setLoadState("decrypting");
      const decrypted: DecryptedOrder[] = [];

      for (const raw of rawOrders) {
        try {
          const results = await fhevm.userDecrypt(
            [{ handle: raw.encryptedPrice, contractAddress: contractAddress }],
            privateKey,
            publicKey,
            signature,
            [contractAddress],
            address,
            startTimestamp,
            durationDays,
          );

          decrypted.push({
            ...raw,
            price: results[raw.encryptedPrice as `0x${string}`] as bigint,
          });
        } catch (err) {
          console.error(`Failed to decrypt order ${raw.id.toString()}:`, err);
          decrypted.push({ ...raw, price: 0n });
        }
      }

      setOrders(decrypted);
      setLoadState("idle");
    } catch (err) {
      console.error("[MyOrders] loadOrders failed:", err);
      setLoadState("idle");
    }
  }, [address, isConnected, contractAddress]);

  useEffect(() => {
    if (hasLoaded && refreshTrigger !== undefined) {
      loadOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const handleCancel = async (orderId: bigint) => {
    if (!walletClient || !address) return;
    setCancellingId(orderId);
    try {
      await writeContract(walletClient, "cancelOrder", [orderId], address, contractAddress);
      await loadOrders();
    } catch (e) {
      if (isUserRejection(e)) { toast("Transaction cancelled"); return; }
      console.error("cancelOrder:", e);
    } finally {
      setCancellingId(null);
    }
  };

  const handleMarkFilled = async (orderId: bigint) => {
    if (!walletClient || !address) return;
    setMarkFilledId(orderId);
    try {
      await writeContract(walletClient, "markFilled", [orderId], address, contractAddress);
      await loadOrders();
    } catch (e) {
      if (isUserRejection(e)) { toast("Transaction cancelled"); return; }
      console.error("markFilled:", e);
    } finally {
      setMarkFilledId(null);
    }
  };

  const handleWithdraw = async (orderId: bigint) => {
    if (!walletClient || !address) return;
    setWithdrawingId(orderId);
    try {
      await writeContract(walletClient, "withdrawUnusedEscrow", [orderId], address, contractAddress);
      await loadOrders();
    } catch (e) {
      if (isUserRejection(e)) { toast("Transaction cancelled"); return; }
      console.error("withdrawUnusedEscrow:", e);
    } finally {
      setWithdrawingId(null);
    }
  };

  const loading = loadState === "fetching" || loadState === "decrypting";

  if (!mounted || !isConnected) {
    return (
      <div className="bg-[#0f111a] rounded-xl p-6 border border-[#1a1f35]">
        <h2 className="text-base font-bold text-[#e2e8f0] mb-2 font-mono tracking-wide">My Orders</h2>
        <p className="text-sm text-[#4a5578] font-mono">
          {mounted ? "Connect your wallet to view your orders." : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f111a] rounded-xl p-6 border border-[#1a1f35] hover:border-[#252c48] transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-[#e2e8f0] font-mono tracking-wide">My Orders</h2>
        <button
          onClick={loadOrders}
          disabled={loading || loadState === "signing"}
          className="text-xs text-[#00f0ff]/60 hover:text-[#00f0ff] disabled:opacity-50 transition-colors font-mono"
        >
          {loadState === "fetching"
            ? "Fetching…"
            : loadState === "signing"
              ? "Check MetaMask…"
              : loadState === "decrypting"
                ? "Decrypting…"
                : "Decrypt & Load"}
        </button>
      </div>

      {loadState === "signing" && (
        <div className="mb-3 rounded-lg bg-[#00f0ff]/5 border border-[#00f0ff]/20 px-4 py-3 text-sm text-[#00f0ff]/80 font-mono">
          <span className="font-semibold text-[#00f0ff]">Signature required</span> — approve in MetaMask. Free off-chain, no gas.
        </div>
      )}

      {loadState === "rejected" && (
        <div className="mb-3 rounded-lg bg-[#3d0015]/40 border border-[#ff3b6b]/30 px-4 py-3 text-sm text-[#ff3b6b] font-mono">
          Signature rejected. Click <span className="font-semibold">Decrypt & Load</span> to retry.
        </div>
      )}

      {!hasLoaded ? (
        <div className="text-center py-6">
          <p className="text-sm text-[#4a5578] mb-4 font-mono">
            Click below to decrypt and view your orders. MetaMask will ask for a free off-chain signature.
          </p>
          <button
            onClick={loadOrders}
            className="px-5 py-2.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/40 hover:border-[#00f0ff]/70 text-[#00f0ff] text-sm font-semibold rounded-lg transition-all font-mono"
          >
            Decrypt & Load Orders
          </button>
        </div>
      ) : loading && orders.length === 0 ? (
        <p className="text-sm text-[#4a5578] font-mono">
          {loadState === "decrypting" ? "Decrypting your orders…" : "Fetching order IDs…"}
        </p>
      ) : orders.length === 0 && loadState === "idle" ? (
        <p className="text-sm text-[#4a5578] font-mono">No orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[#1a1f35]">
                <th className="pb-2 pr-3 text-xs text-[#374060] font-mono uppercase tracking-wider">ID</th>
                <th className="pb-2 pr-3 text-xs text-[#374060] font-mono uppercase tracking-wider">Side</th>
                <th className="pb-2 pr-3 text-xs text-[#374060] font-mono uppercase tracking-wider">Price</th>
                <th className="pb-2 pr-3 text-xs text-[#374060] font-mono uppercase tracking-wider">Amount</th>
                <th className="pb-2 pr-3 text-xs text-[#374060] font-mono uppercase tracking-wider">Remaining</th>
                <th className="pb-2 pr-3 text-xs text-[#374060] font-mono uppercase tracking-wider">Escrowed</th>
                <th className="pb-2 pr-3 text-xs text-[#374060] font-mono uppercase tracking-wider">Status</th>
                <th className="pb-2 text-xs text-[#374060] font-mono uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1f35]">
              {orders.map((order) => (
                <tr key={order.id.toString()} className="text-[#8892b0] hover:bg-[#141622]/50 transition-colors">
                  <td className="py-3 pr-3 font-mono text-xs">
                    <a
                      href={`https://sepolia.etherscan.io/address/${contractAddress}?a=${address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#4a5578] hover:text-[#00f0ff]/70 transition-colors"
                    >
                      #{order.id.toString()} ↗
                    </a>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                        order.side === OrderSide.BUY
                          ? "bg-[#003d28] text-[#00ff9d] border border-[#00ff9d]/30"
                          : "bg-[#3d0015] text-[#ff3b6b] border border-[#ff3b6b]/30"
                      }`}
                    >
                      {order.side === OrderSide.BUY ? "BUY" : "SELL"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-mono text-[#e2e8f0] text-sm">{order.price.toString()}</td>
                  <td className="py-3 pr-3 font-mono text-sm">{order.amount.toString()}</td>
                  <td className="py-3 pr-3 font-mono text-sm">
                    <span className={order.remainingAmount === 0n ? "text-[#00ff9d]" : "text-[#8892b0]"}>
                      {order.remainingAmount.toString()}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-[#8892b0]">
                    {formatEscrow(order.escrowedTokens, order.side)}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono ${
                        order.status === OrderStatus.OPEN
                          ? "bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/25"
                          : order.status === OrderStatus.FILLED
                            ? "bg-[#003d28] text-[#00ff9d] border border-[#00ff9d]/30"
                            : "bg-[#141622] text-[#4a5578] border border-[#1a1f35]"
                      }`}
                    >
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2 flex-wrap">
                      {order.status === OrderStatus.OPEN && (
                        <>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancellingId === order.id}
                            className="text-xs text-[#ff3b6b]/70 hover:text-[#ff3b6b] disabled:opacity-50 transition-colors font-mono"
                          >
                            {cancellingId === order.id ? "…" : "Cancel"}
                          </button>
                          {order.remainingAmount === 0n && (
                            <button
                              onClick={() => handleMarkFilled(order.id)}
                              disabled={markFilledId === order.id}
                              className="text-xs text-[#00ff9d]/70 hover:text-[#00ff9d] disabled:opacity-50 transition-colors font-mono"
                            >
                              {markFilledId === order.id ? "…" : "Mark Filled"}
                            </button>
                          )}
                        </>
                      )}
                      {(order.status === OrderStatus.FILLED || order.status === OrderStatus.CANCELLED) &&
                        order.escrowedTokens > 0n && (
                          <button
                            onClick={() => handleWithdraw(order.id)}
                            disabled={withdrawingId === order.id}
                            className="text-xs text-amber-400/70 hover:text-amber-400 disabled:opacity-50 transition-colors font-mono"
                          >
                            {withdrawingId === order.id ? "…" : "Withdraw Escrow"}
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-[#374060] font-mono">
        Prices decrypted locally via EIP-712. Amounts and escrow are public on-chain.
      </p>
    </div>
  );
}
