"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";
import { getPublicClient, CIPHERBOOK_ABI } from "@/lib/contract";
import { getFhevmInstance } from "@/lib/fhevm";
import { isUserRejection } from "@/lib/errors";
import { toast } from "@/components/Toast";

interface Settlement {
  id: bigint;
  buyOrderId: bigint;
  sellOrderId: bigint;
  tradeQty: bigint;
  encTradeQty: `0x${string}`;
  executed: boolean;
}

type ExecState = "idle" | "decrypting" | "submitting" | "done" | "error";

interface Props {
  onSettled?: () => void;
  contractAddress: `0x${string}`;
}

export default function PendingSettlements({ onSettled, contractAddress }: Props) {
  const { address, isConnected } = useAccount();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [execState, setExecState] = useState<Record<string, ExecState>>({});
  const [execError, setExecError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const publicClient = getPublicClient();
      const ids = await publicClient.readContract({
        address: contractAddress,
        abi: CIPHERBOOK_ABI,
        functionName: "getPendingSettlementIds",
      }) as bigint[];

      const all = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: contractAddress,
            abi: CIPHERBOOK_ABI,
            functionName: "getPendingSettlement",
            args: [id],
          }) as Promise<Settlement>
        )
      );
      setSettlements(all.filter((s) => !s.executed));
    } catch (e) {
      console.error("fetchSettlements:", e);
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  async function executeSettlement(settlement: Settlement) {
    const key = settlement.id.toString();
    setExecState((s) => ({ ...s, [key]: "decrypting" }));
    setExecError((s) => ({ ...s, [key]: "" }));

    try {
      const fhevm = await getFhevmInstance();

      // publicDecrypt returns KMS-signed proof for anyone to submit
      const result = await (fhevm as unknown as {
        publicDecrypt: (handles: `0x${string}`[]) => Promise<{
          clearValues: Record<string, unknown>;
          abiEncodedClearValues: `0x${string}`;
          decryptionProof: `0x${string}`;
        }>;
      }).publicDecrypt([settlement.encTradeQty]);

      const clearVal = BigInt(
        Object.values(result.clearValues)[0] as bigint | string
      );

      setExecState((s) => ({ ...s, [key]: "submitting" }));

      if (!address || !window.ethereum) throw new Error("Wallet not connected");

      const walletClient = createWalletClient({
        account: address,
        chain: sepolia,
        transport: custom(window.ethereum),
      });
      const publicClient = getPublicClient();

      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi: CIPHERBOOK_ABI,
        functionName: "executeSettlement",
        args: [
          settlement.id,
          clearVal,
          [settlement.encTradeQty],
          result.abiEncodedClearValues,
          result.decryptionProof,
        ],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      setExecState((s) => ({ ...s, [key]: "done" }));
      await fetchSettlements();
      onSettled?.();
    } catch (e) {
      if (isUserRejection(e)) {
        toast("Transaction cancelled");
        setExecState((s) => ({ ...s, [key]: "idle" }));
        return;
      }
      console.error("executeSettlement:", e);
      setExecState((s) => ({ ...s, [key]: "error" }));
      setExecError((s) => ({ ...s, [key]: e instanceof Error ? e.message : String(e) }));
    }
  }

  const buttonLabel = (id: bigint) => {
    const state = execState[id.toString()] ?? "idle";
    if (state === "decrypting") return "Decrypting via KMS…";
    if (state === "submitting") return "Submitting — check wallet…";
    if (state === "done") return "Settled";
    return "Execute Settlement";
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Pending Settlements</h2>
        <button
          onClick={fetchSettlements}
          disabled={loading}
          className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {settlements.length === 0 ? (
        <p className="text-sm text-gray-500">
          {loading ? "Loading settlements…" : "No pending settlements."}
        </p>
      ) : (
        <div className="space-y-3">
          {settlements.map((s) => {
            const key = s.id.toString();
            const state = execState[key] ?? "idle";
            const busy = state === "decrypting" || state === "submitting";
            return (
              <div
                key={key}
                className="bg-gray-800 rounded-lg p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Settlement #{key}</span>
                  <span className="font-mono">
                    Buy #{s.buyOrderId.toString()} × Sell #{s.sellOrderId.toString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Optimistic qty: <span className="text-white font-mono">{s.tradeQty.toString()} TKN</span>
                  {" "}— actual qty revealed by KMS on execute
                </div>

                {execError[key] && (
                  <p className="text-xs text-red-400 break-words">{execError[key]}</p>
                )}

                <button
                  onClick={() => executeSettlement(s)}
                  disabled={busy || state === "done" || !isConnected}
                  className="mt-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors self-end"
                >
                  {buttonLabel(s.id)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
