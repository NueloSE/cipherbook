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
import { EncryptedReveal } from "@/components/EncryptedReveal";

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
      <div className="card p-6">
        <h2 className="text-sm font-bold text-white mb-2 font-mono uppercase tracking-widest">My Orders</h2>
        <p className="text-sm text-white/30 font-mono">
          {mounted ? "Connect your wallet to view your orders." : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white font-mono uppercase tracking-widest">My Orders</h2>
        <button
          onClick={loadOrders}
          disabled={loading || loadState === "signing"}
          className="text-xs text-[#00f0ff]/60 hover:text-[#00f0ff] disabled:opacity-40 transition-colors font-mono"
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
        <div className="mb-4 card-inner px-4 py-3 text-sm text-[#00f0ff]/80 font-mono border border-[#00f0ff]/20">
          <span className="font-semibold text-[#00f0ff]">Signature required</span> — approve in MetaMask. Free off-chain, no gas.
        </div>
      )}

      {loadState === "rejected" && (
        <div className="mb-4 card-inner px-4 py-3 text-sm text-[#ff4757] font-mono border border-[#ff4757]/30">
          Signature rejected. Click <span className="font-semibold">Decrypt & Load</span> to retry.
        </div>
      )}

      {!hasLoaded ? (
        <div className="text-center py-8">
          <p className="text-sm text-white/30 mb-5 font-mono max-w-sm mx-auto leading-relaxed">
            Click below to decrypt and view your orders. MetaMask will ask for a free off-chain signature.
          </p>
          <button
            onClick={loadOrders}
            className="btn-app px-6 py-2.5 rounded-xl text-sm font-semibold font-mono"
          >
            Decrypt & Load Orders
          </button>
        </div>
      ) : loading && orders.length === 0 ? (
        <p className="text-sm text-white/30 font-mono">
          {loadState === "decrypting" ? "Decrypting your orders…" : "Fetching order IDs…"}
        </p>
      ) : orders.length === 0 && loadState === "idle" ? (
        <p className="text-sm text-white/30 font-mono">No orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/8">
                <th className="pb-2.5 pr-3 data-label">ID</th>
                <th className="pb-2.5 pr-3 data-label">Side</th>
                <th className="pb-2.5 pr-3 data-label">Price</th>
                <th className="pb-2.5 pr-3 data-label">Amount</th>
                <th className="pb-2.5 pr-3 data-label">Remaining</th>
                <th className="pb-2.5 pr-3 data-label">Escrowed</th>
                <th className="pb-2.5 pr-3 data-label">Status</th>
                <th className="pb-2.5 data-label">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {orders.map((order) => (
                <tr key={order.id.toString()} className="text-white/50 hover:bg-white/3 transition-colors">
                  <td className="py-3 pr-3 font-mono text-xs">
                    <a
                      href={`https://sepolia.etherscan.io/address/${contractAddress}?a=${address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-white/25 hover:text-[#00f0ff]/60 transition-colors"
                    >
                      #{order.id.toString()} ↗
                    </a>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        order.side === OrderSide.BUY
                          ? "bg-[#00d68f]/12 text-[#00d68f] border border-[#00d68f]/25"
                          : "bg-[#ff4757]/10 text-[#ff4757] border border-[#ff4757]/25"
                      }`}
                    >
                      {order.side === OrderSide.BUY ? "BUY" : "SELL"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-white text-sm tabular">
                    <EncryptedReveal
                      value={order.price.toString()}
                      duration={700}
                      delay={order.id ? Number(order.id % 5n) * 80 : 0}
                    />
                  </td>
                  <td className="py-3 pr-3 font-mono text-sm tabular">{order.amount.toString()}</td>
                  <td className="py-3 pr-3 font-mono text-sm tabular">
                    <span className={order.remainingAmount === 0n ? "text-[#00d68f]" : "text-white/40"}>
                      {order.remainingAmount.toString()}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-white/35 tabular">
                    {formatEscrow(order.escrowedTokens, order.side)}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                        order.status === OrderStatus.OPEN
                          ? "bg-[#00f0ff]/8 text-[#00f0ff]/80 border border-[#00f0ff]/20"
                          : order.status === OrderStatus.FILLED
                            ? "bg-[#00d68f]/10 text-[#00d68f] border border-[#00d68f]/20"
                            : "glass-inner text-white/25"
                      }`}
                    >
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2.5 flex-wrap">
                      {order.status === OrderStatus.OPEN && (
                        <>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancellingId === order.id}
                            className="text-xs text-[#ff4757]/50 hover:text-[#ff4757] disabled:opacity-40 transition-colors font-mono"
                          >
                            {cancellingId === order.id ? "…" : "Cancel"}
                          </button>
                          {order.remainingAmount === 0n && (
                            <button
                              onClick={() => handleMarkFilled(order.id)}
                              disabled={markFilledId === order.id}
                              className="text-xs text-[#00d68f]/60 hover:text-[#00d68f] disabled:opacity-40 transition-colors font-mono"
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
                            className="text-xs text-amber-400/50 hover:text-amber-400 disabled:opacity-40 transition-colors font-mono"
                          >
                            {withdrawingId === order.id ? "…" : "Withdraw"}
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

      <p className="mt-4 text-[10px] text-white/15 font-mono">
        Prices decrypted locally via EIP-712 · Amounts and escrow are public on-chain.
      </p>
    </div>
  );
}
