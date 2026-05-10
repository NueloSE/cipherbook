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
  const [sellPrice, setSellPrice] = useState("");
  const [quoteEscrow, setQuoteEscrow] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [baseBalance, setBaseBalance] = useState<bigint>(0n);
  const [quoteBalance, setQuoteBalance] = useState<bigint>(0n);

  useEffect(() => {
    if (!address) return;
    Promise.all([
      readERC20<bigint>(baseTokenAddress, "balanceOf", [address]),
      readERC20<bigint>(quoteTokenAddress, "balanceOf", [address]),
    ])
      .then(([b, q]) => { setBaseBalance(b); setQuoteBalance(q); })
      .catch(() => {});
  }, [address, baseTokenAddress, quoteTokenAddress]);

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

      setStatus("checking");
      const publicClient = getPublicClient();

      if (side === OrderSide.SELL) {
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

      setStatus("encrypting");
      const fhevm = await getFhevmInstance();

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
      // refresh displayed balances after escrow is deducted
      Promise.all([
        readERC20<bigint>(baseTokenAddress, "balanceOf", [address]),
        readERC20<bigint>(quoteTokenAddress, "balanceOf", [address]),
      ]).then(([b, q]) => { setBaseBalance(b); setQuoteBalance(q); }).catch(() => {});
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
    approving: "Approving — check wallet…",
    encrypting: "Encrypting with FHE…",
    submitting: "Waiting for wallet…",
    done: "Order Placed",
    error: `Place ${side === OrderSide.BUY ? "Buy" : "Sell"} Order`,
  };

  const inputCls = "cyber-input w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-50";

  return (
    <div className="card p-5">
      <h2 className="text-sm font-bold text-white mb-4 font-mono uppercase tracking-widest">Place Limit Order</h2>

      {/* Side selector */}
      <div className="flex rounded-xl overflow-hidden border border-white/10 mb-5">
        {(
          [
            ["BUY", OrderSide.BUY],
            ["SELL", OrderSide.SELL],
          ] as const
        ).map(([label, val]) => (
          <button
            key={label}
            onClick={() => setSide(val)}
            className={`flex-1 py-2.5 text-sm font-bold font-mono transition-all ${
              side === val
                ? val === OrderSide.BUY
                  ? "bg-[#00d68f] text-[#020408]"
                  : "bg-[#ff4757] text-white"
                : "bg-[#0a0d17] text-white/35 hover:text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="data-label">
              Amount ({BASE_TOKEN_SYMBOL})
            </label>
            {address && (
              <span className="text-xs text-white/20 font-mono">
                Bal:{" "}
                <span className="text-white/40">
                  {(Number(baseBalance) / 10 ** BASE_TOKEN_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 })} {BASE_TOKEN_SYMBOL}
                </span>
              </span>
            )}
          </div>
          <input
            type="number"
            min="1"
            placeholder="e.g. 10"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isBusy}
            className={inputCls}
          />
        </div>

        {side === OrderSide.SELL ? (
          <div>
            <label className="data-label block mb-1.5">
              Min Price ({QUOTE_TOKEN_SYMBOL}/{BASE_TOKEN_SYMBOL}, encrypted)
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 10"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              disabled={isBusy}
              className={inputCls}
            />
            <p className="mt-1.5 text-[10px] text-white/20 font-mono">
              FHE-encrypted before leaving your browser.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="data-label">
                Max Payment ({QUOTE_TOKEN_SYMBOL} budget)
              </label>
              {address && (
                <span className="text-xs text-white/20 font-mono">
                  Bal:{" "}
                  <span className="text-white/40">
                    {(Number(quoteBalance) / 10 ** QUOTE_TOKEN_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 })} {QUOTE_TOKEN_SYMBOL}
                  </span>
                </span>
              )}
            </div>
            <input
              type="number"
              min="1"
              placeholder="e.g. 110"
              value={quoteEscrow}
              onChange={(e) => setQuoteEscrow(e.target.value)}
              disabled={isBusy}
              className={inputCls}
            />
            {effectiveBuyPrice !== null && (
              <p className="mt-1.5 text-[10px] text-[#00f0ff]/60 font-mono">
                Effective bid:{" "}
                <span className="text-[#00f0ff]/90 font-bold">
                  {effectiveBuyPrice} {QUOTE_TOKEN_SYMBOL}/{BASE_TOKEN_SYMBOL}
                </span>
                {" "}— FHE-encrypted
              </p>
            )}
            {!effectiveBuyPrice && (
              <p className="mt-1.5 text-[10px] text-white/20 font-mono">
                Effective price = budget ÷ amount. Unused {QUOTE_TOKEN_SYMBOL} returned after settlement.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!mounted || isBusy || !isConnected}
        suppressHydrationWarning
        className={`w-full py-3 rounded-xl text-sm font-bold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          status === "done"
            ? "bg-[#00d68f] text-[#020408]"
            : side === OrderSide.BUY
              ? "bg-[#00d68f] text-[#020408] hover:bg-[#12e69a] hover:shadow-[0_0_24px_rgba(0,214,143,0.3)]"
              : "bg-[#ff4757] text-white hover:bg-[#ff6370] hover:shadow-[0_0_24px_rgba(255,71,87,0.3)]"
        }`}
      >
        {statusLabel[status]}
      </button>

      {status === "error" && errorMsg && (
        <div className="mt-3 p-3 card-inner border-[#ff4757]/30">
          <p className="text-xs text-[#ff4757] wrap-break-word font-mono">{errorMsg}</p>
        </div>
      )}

      {mounted && !isConnected && (
        <p className="mt-3 text-xs text-white/20 text-center font-mono">Connect your wallet to place orders</p>
      )}

      <p className="mt-3 text-[10px] text-white/15 text-center font-mono">
        Price FHE-encrypted before leaving your browser · MEV-proof
      </p>
    </div>
  );
}
