"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { createWalletClient, custom } from "viem";
import { sepolia } from "viem/chains";
import { getFhevmInstance } from "@/lib/fhevm";
import {
  getPublicClient,
  getWalletClient,
  CIPHERBOOK_ABI,
  readERC20,
  writeERC20,
} from "@/lib/contract";
import { isUserRejection } from "@/lib/errors";
import { toast } from "@/components/Toast";
import {
  OrderSide,
  BASE_TOKEN_SYMBOL,
  BASE_TOKEN_DECIMALS,
  QUOTE_TOKEN_SYMBOL,
  QUOTE_TOKEN_DECIMALS,
} from "@/lib/config";

function toHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

type Status = "idle" | "checking" | "approving" | "encrypting" | "submitting" | "done" | "error";

interface PlaceOrderProps {
  onOrderPlaced?: () => void;
  contractAddress: `0x${string}`;
  baseTokenAddress: `0x${string}`;
  quoteTokenAddress: `0x${string}`;
}

export function PlaceOrder({ onOrderPlaced, contractAddress, baseTokenAddress, quoteTokenAddress }: PlaceOrderProps) {
  const { address, isConnected } = useAccount();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [side, setSide] = useState<0 | 1>(OrderSide.BUY);
  const [amount, setAmount] = useState("");
  // SELL only — the minimum price seller will accept (QUSD per TKN)
  const [sellPrice, setSellPrice] = useState("");
  // BUY only — the max QUSD budget; effective price = quoteEscrow / amount
  const [quoteEscrow, setQuoteEscrow] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Derived effective BUY price (integer, QUSD per TKN)
  const effectiveBuyPrice =
    amount && quoteEscrow && Number(amount) > 0
      ? Math.floor(Number(quoteEscrow) / Number(amount))
      : null;

  const handleSubmit = async () => {
    if (!address || !isConnected) {
      setStatus("error");
      setErrorMsg("Wallet not connected.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setStatus("error");
      setErrorMsg("Please enter a valid amount.");
      return;
    }
    if (side === OrderSide.SELL && !sellPrice) {
      setStatus("error");
      setErrorMsg("Please enter your minimum sell price.");
      return;
    }
    if (side === OrderSide.BUY && (!quoteEscrow || Number(quoteEscrow) <= 0)) {
      setStatus("error");
      setErrorMsg("Please enter your max payment (QUSD budget).");
      return;
    }
    if (!window.ethereum) {
      setStatus("error");
      setErrorMsg("MetaMask not found.");
      return;
    }

    try {
      setErrorMsg("");

      const chainId = await window.ethereum.request({ method: "eth_chainId" }) as string;
      if (parseInt(chainId, 16) !== sepolia.id) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
        } catch {
          setStatus("error");
          setErrorMsg("Please switch MetaMask to Sepolia testnet.");
          return;
        }
      }

      // ── Approval ──────────────────────────────────────────────────────────
      setStatus("checking");
      const publicClient = getPublicClient();

      if (side === OrderSide.SELL) {
        // Contract scales by 10^decimals internally, so approve the full wei amount
        const needed = BigInt(amount) * BigInt(10 ** BASE_TOKEN_DECIMALS);
        const allowance = await readERC20<bigint>(
          baseTokenAddress,
          "allowance",
          [address, contractAddress],
        );
        if (allowance < needed) {
          setStatus("approving");
          const hash = await writeERC20(
            getWalletClient()!,
            baseTokenAddress,
            "approve",
            [contractAddress, needed],
            address,
          );
          await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
        }
      } else {
        // Buyer approves QUSD (user enters whole QUSD, multiply by 10^6 for raw)
        const needed = BigInt(quoteEscrow) * BigInt(10 ** QUOTE_TOKEN_DECIMALS);
        const allowance = await readERC20<bigint>(
          quoteTokenAddress,
          "allowance",
          [address, contractAddress],
        );
        if (allowance < needed) {
          setStatus("approving");
          const hash = await writeERC20(
            getWalletClient()!,
            quoteTokenAddress,
            "approve",
            [contractAddress, needed],
            address,
          );
          await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
        }
      }

      // ── Encrypt price ─────────────────────────────────────────────────────
      setStatus("encrypting");
      const fhevm = await getFhevmInstance();

      // For BUY: encrypt the effective price (quoteEscrow / amount) so it's
      // tied to the actual payment — prevents bidding high while paying low.
      // For SELL: encrypt the user-entered minimum price directly.
      const priceToEncrypt =
        side === OrderSide.BUY
          ? BigInt(Math.floor(Number(quoteEscrow) / Number(amount)))
          : BigInt(sellPrice);

      const priceEnc = await fhevm
        .createEncryptedInput(contractAddress, address)
        .add64(priceToEncrypt)
        .encrypt();

      setStatus("submitting");

      const walletClient = createWalletClient({
        account: address,
        chain: sepolia,
        transport: custom(window.ethereum),
      });

      const amountU64 = BigInt(amount);
      const quoteEscrowWei =
        side === OrderSide.BUY
          ? BigInt(quoteEscrow) * BigInt(10 ** QUOTE_TOKEN_DECIMALS)
          : 0n;

      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi: CIPHERBOOK_ABI,
        functionName: "placeLimitOrder",
        args: [side, toHex(priceEnc.handles[0]) as `0x${string}`, toHex(priceEnc.inputProof), amountU64, quoteEscrowWei],
        account: address,
      });

      const hash = await walletClient.writeContract(request);
      console.log("Order placed, tx:", hash);

      setStatus("done");
      setAmount("");
      setSellPrice("");
      setQuoteEscrow("");
      onOrderPlaced?.();
      setTimeout(() => setStatus("idle"), 3000);
    } catch (e: unknown) {
      if (isUserRejection(e)) {
        toast("Transaction cancelled");
        setStatus("idle");
        return;
      }
      console.error("PlaceOrder error:", e);
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const isBusy = status !== "idle" && status !== "error" && status !== "done";

  const statusLabel: Record<Status, string> = {
    idle: `Place ${side === OrderSide.BUY ? "Buy" : "Sell"} Order`,
    checking: "Checking allowance…",
    approving: "Approving tokens — check wallet…",
    encrypting: "Encrypting price with FHE…",
    submitting: "Waiting for wallet…",
    done: "Order Placed",
    error: `Place ${side === OrderSide.BUY ? "Buy" : "Sell"} Order`,
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
      <h2 className="text-lg font-bold text-white mb-4">Place Limit Order</h2>

      <div className="flex rounded-lg overflow-hidden border border-gray-600 mb-5">
        {(
          [
            ["BUY", OrderSide.BUY],
            ["SELL", OrderSide.SELL],
          ] as const
        ).map(([label, val]) => (
          <button
            key={label}
            onClick={() => setSide(val)}
            className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
              side === val
                ? val === OrderSide.BUY
                  ? "bg-emerald-600 text-white"
                  : "bg-rose-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Amount <span className="text-gray-600">({BASE_TOKEN_SYMBOL})</span>
          </label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 10"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isBusy}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm disabled:opacity-50"
          />
        </div>

        {side === OrderSide.SELL ? (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Min Price <span className="text-gray-600">({QUOTE_TOKEN_SYMBOL} per {BASE_TOKEN_SYMBOL}, encrypted)</span>
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 10"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              disabled={isBusy}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-600">
              Your minimum acceptable price. Encrypted before leaving your browser.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Max Payment <span className="text-gray-600">({QUOTE_TOKEN_SYMBOL} budget)</span>
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 110"
              value={quoteEscrow}
              onChange={(e) => setQuoteEscrow(e.target.value)}
              disabled={isBusy}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm disabled:opacity-50"
            />
            {effectiveBuyPrice !== null && (
              <p className="mt-1 text-xs text-indigo-400">
                Effective price: <span className="font-mono font-bold">{effectiveBuyPrice} {QUOTE_TOKEN_SYMBOL}/{BASE_TOKEN_SYMBOL}</span>
                {" "}— this will be FHE-encrypted as your bid price
              </p>
            )}
            {!effectiveBuyPrice && (
              <p className="mt-1 text-xs text-gray-600">
                Effective price = max payment ÷ amount. Unused {QUOTE_TOKEN_SYMBOL} returned after settlement.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!mounted || isBusy || !isConnected}
        suppressHydrationWarning
        className={`w-full py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          side === OrderSide.BUY
            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
            : "bg-rose-600 hover:bg-rose-500 text-white"
        }`}
      >
        {statusLabel[status]}
      </button>

      {status === "error" && errorMsg && (
        <div className="mt-3 p-3 bg-rose-950 border border-rose-800 rounded-lg">
          <p className="text-xs text-rose-300 break-words">{errorMsg}</p>
        </div>
      )}

      {mounted && !isConnected && (
        <p className="mt-3 text-xs text-gray-500 text-center">Connect your wallet to place orders</p>
      )}

      <p className="mt-3 text-xs text-gray-600 text-center">
        Price is FHE-encrypted before leaving your browser — MEV-proof
      </p>
    </div>
  );
}
