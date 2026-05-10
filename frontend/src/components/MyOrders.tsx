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
  BASE_TOKEN_DECIMALS,
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
  const decimals = side === OrderSide.SELL ? BASE_TOKEN_DECIMALS : QUOTE_TOKEN_DECIMALS;
  const symbol   = side === OrderSide.SELL ? BASE_TOKEN_SYMBOL  : QUOTE_TOKEN_SYMBOL;
  const divisor  = BigInt(10 ** decimals);
  const whole    = raw / divisor;
  const frac     = (raw % divisor).toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${frac} ${symbol}`;
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

      // Fetch all raw orders (amounts are plaintext in new contract)
      const rawOrders = await Promise.all(
        ids.map((id) => readContract<RawOrder>("getMyOrder", [id], address, contractAddress))
      );

      // Decrypt only the price handle via EIP-712 user decryption
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
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-2">My Orders</h2>
        <p className="text-sm text-gray-500">
          {mounted ? "Connect your wallet to view your orders." : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">My Orders</h2>
        <button
          onClick={loadOrders}
          disabled={loading || loadState === "signing"}
          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
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
        <div className="mb-3 rounded-lg bg-indigo-950 border border-indigo-700 px-4 py-3 text-sm text-indigo-300">
          <span className="font-semibold">MetaMask signature required</span> — check your MetaMask popup and click{" "}
          <span className="font-semibold">Sign</span>. Free off-chain signature, no gas.
        </div>
      )}

      {loadState === "rejected" && (
        <div className="mb-3 rounded-lg bg-rose-950 border border-rose-700 px-4 py-3 text-sm text-rose-300">
          Signature rejected. Click <span className="font-semibold">Decrypt & Load</span> and approve the signature to view your orders.
        </div>
      )}

      {!hasLoaded ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">
            Click below to decrypt and view your orders. MetaMask will ask for a free signature.
          </p>
          <button
            onClick={loadOrders}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Decrypt & Load Orders
          </button>
        </div>
      ) : loading && orders.length === 0 ? (
        <p className="text-sm text-gray-500">
          {loadState === "decrypting" ? "Decrypting your orders…" : "Fetching order IDs…"}
        </p>
      ) : orders.length === 0 && loadState === "idle" ? (
        <p className="text-sm text-gray-500">No orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                <th className="pb-2 pr-3">ID</th>
                <th className="pb-2 pr-3">Side</th>
                <th className="pb-2 pr-3">Price</th>
                <th className="pb-2 pr-3">Amount</th>
                <th className="pb-2 pr-3">Remaining</th>
                <th className="pb-2 pr-3">Escrowed</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {orders.map((order) => (
                <tr key={order.id.toString()} className="text-gray-300">
                  <td className="py-2.5 pr-3 font-mono text-gray-500">#{order.id.toString()}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        order.side === OrderSide.BUY
                          ? "bg-emerald-900 text-emerald-300"
                          : "bg-rose-900 text-rose-300"
                      }`}
                    >
                      {order.side === OrderSide.BUY ? "BUY" : "SELL"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono">{order.price.toString()}</td>
                  <td className="py-2.5 pr-3 font-mono">{order.amount.toString()}</td>
                  <td className="py-2.5 pr-3 font-mono">
                    <span className={order.remainingAmount === 0n ? "text-emerald-400" : ""}>
                      {order.remainingAmount.toString()}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">
                    {formatEscrow(order.escrowedTokens, order.side)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        order.status === OrderStatus.OPEN
                          ? "bg-blue-900 text-blue-300"
                          : order.status === OrderStatus.FILLED
                            ? "bg-emerald-900 text-emerald-300"
                            : "bg-gray-700 text-gray-400"
                      }`}
                    >
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2 flex-wrap">
                      {order.status === OrderStatus.OPEN && (
                        <>
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancellingId === order.id}
                            className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors"
                          >
                            {cancellingId === order.id ? "…" : "Cancel"}
                          </button>
                          {order.remainingAmount === 0n && (
                            <button
                              onClick={() => handleMarkFilled(order.id)}
                              disabled={markFilledId === order.id}
                              className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
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
                            className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
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

      <p className="mt-3 text-xs text-gray-600">
        Price is decrypted locally using your wallet signature. Amounts and escrow are public on-chain.
      </p>
    </div>
  );
}
