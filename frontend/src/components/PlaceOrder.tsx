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

  const inputCls = "w-full bg-[#141622] text-[#e2e8f0] rounded-lg px-3 py-2.5 border border-[#1a1f35] focus:border-[#00f0ff]/50 focus:outline-none text-sm font-mono disabled:opacity-50 transition-colors placeholder-[#374060]";

  return (
    <div className="bg-[#0f111a] rounded-xl p-6 border border-[#1a1f35] hover:border-[#252c48] transition-colors">
      <h2 className="text-base font-bold text-[#e2e8f0] mb-4 font-mono tracking-wide">Place Limit Order</h2>

      {/* Side selector */}
      <div className="flex rounded-lg overflow-hidden border border-[#1a1f35] mb-5">
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
                  ? "bg-[#003d28] border-b-2 border-[#00ff9d] text-[#00ff9d]"
                  : "bg-[#3d0015] border-b-2 border-[#ff3b6b] text-[#ff3b6b]"
                : "bg-[#141622] text-[#4a5578] hover:text-[#8892b0]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-[#4a5578] font-mono uppercase tracking-wider">
              Amount <span className="text-[#374060] normal-case">({BASE_TOKEN_SYMBOL})</span>
            </label>
            {address && (
              <span className="text-xs text-[#374060] font-mono">
                Bal:{" "}
                <span className="text-[#8892b0]">
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
            <label className="block text-xs text-[#4a5578] mb-1.5 font-mono uppercase tracking-wider">
              Min Price{" "}
              <span className="text-[#374060] normal-case">
                ({QUOTE_TOKEN_SYMBOL}/{BASE_TOKEN_SYMBOL}, encrypted)
              </span>
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
            <p className="mt-1 text-xs text-[#374060] font-mono">
              FHE-encrypted before leaving your browser.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-[#4a5578] font-mono uppercase tracking-wider">
                Max Payment{" "}
                <span className="text-[#374060] normal-case">({QUOTE_TOKEN_SYMBOL} budget)</span>
              </label>
              {address && (
                <span className="text-xs text-[#374060] font-mono">
                  Bal:{" "}
                  <span className="text-[#8892b0]">
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
              <p className="mt-1 text-xs text-[#00f0ff]/70 font-mono">
                Effective bid:{" "}
                <span className="text-[#00f0ff] font-bold">
                  {effectiveBuyPrice} {QUOTE_TOKEN_SYMBOL}/{BASE_TOKEN_SYMBOL}
                </span>
                {" "}— FHE-encrypted
              </p>
            )}
            {!effectiveBuyPrice && (
              <p className="mt-1 text-xs text-[#374060] font-mono">
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
        className={`w-full py-3 rounded-lg text-sm font-bold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          status === "done"
            ? "bg-[#003d28] border border-[#00ff9d]/60 text-[#00ff9d]"
            : side === OrderSide.BUY
              ? "bg-[#003d28] border border-[#00ff9d]/40 text-[#00ff9d] hover:bg-[#004d32] hover:border-[#00ff9d]/70"
              : "bg-[#3d0015] border border-[#ff3b6b]/40 text-[#ff3b6b] hover:bg-[#4d001c] hover:border-[#ff3b6b]/70"
        }`}
      >
        {statusLabel[status]}
      </button>

      {status === "error" && errorMsg && (
        <div className="mt-3 p-3 bg-[#3d0015]/40 border border-[#ff3b6b]/30 rounded-lg">
          <p className="text-xs text-[#ff3b6b] wrap-break-word font-mono">{errorMsg}</p>
        </div>
      )}

      {mounted && !isConnected && (
        <p className="mt-3 text-xs text-[#4a5578] text-center font-mono">Connect your wallet to place orders</p>
      )}

      <p className="mt-3 text-xs text-[#374060] text-center font-mono">
        Price FHE-encrypted before leaving your browser — MEV-proof
      </p>
    </div>
  );
}
