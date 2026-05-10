import { createPublicClient, createWalletClient, custom, http, fallback, type WalletClient } from "viem";
import { sepolia } from "viem/chains";
import { CONTRACT_ADDRESS, BASE_TOKEN_ADDRESS, QUOTE_TOKEN_ADDRESS, FACTORY_ADDRESS, SEPOLIA_RPC_URL } from "./config";

const FALLBACK_RPCS = [
  SEPOLIA_RPC_URL,
  "https://sepolia.drpc.org",
  "https://rpc.sepolia.org",
  "https://rpc2.sepolia.org",
];

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const CIPHERBOOK_ABI = [
  {
    name: "placeLimitOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "side", type: "uint8" },
      { name: "encryptedPrice", type: "bytes32" },
      { name: "priceProof", type: "bytes" },
      { name: "amount", type: "uint64" },
      { name: "quoteEscrow", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "runBatchMatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "executeSettlement",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "settlementId", type: "uint256" },
      { name: "decryptedTradeQty", type: "uint64" },
      { name: "handlesList", type: "bytes32[]" },
      { name: "abiEncodedCleartexts", type: "bytes" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "markFilled",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdrawUnusedEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getMyOrderIds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getMyOrder",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "side", type: "uint8" },
          { name: "encryptedPrice", type: "bytes32" },
          { name: "amount", type: "uint64" },
          { name: "remainingAmount", type: "uint64" },
          { name: "escrowedTokens", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getPendingSettlement",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "settlementId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "buyOrderId", type: "uint256" },
          { name: "sellOrderId", type: "uint256" },
          { name: "tradeQty", type: "uint64" },
          { name: "encTradeQty", type: "bytes32" },
          { name: "executed", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getPendingSettlementIds",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getMarketSummary",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_lastTradedPrice", type: "uint256" },
      { name: "_totalVolume", type: "uint256" },
      { name: "_totalTrades", type: "uint256" },
      { name: "_openOrders", type: "uint256" },
    ],
  },
  {
    name: "getOpenOrderCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "baseToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "quoteToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getRecentTrades",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "qty", type: "uint64" },
          { name: "price", type: "uint256" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const FACTORY_ABI = [
  {
    name: "createPair",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "baseToken", type: "address" },
      { name: "quoteToken", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
  {
    name: "getPair",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "baseToken", type: "address" },
      { name: "quoteToken", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "allPairs",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "allPairsLength",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "PairCreated",
    type: "event",
    inputs: [
      { name: "baseToken", type: "address", indexed: true },
      { name: "quoteToken", type: "address", indexed: true },
      { name: "pair", type: "address", indexed: false },
      { name: "pairIndex", type: "uint256", indexed: false },
    ],
  },
] as const;

export function getPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: fallback(FALLBACK_RPCS.map((url) => http(url, { timeout: 10_000 }))),
  });
}

export function getWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum as Parameters<typeof custom>[0]),
  });
}

export async function readContract<T>(
  functionName: string,
  args: unknown[] = [],
  account?: `0x${string}`,
  contractAddress?: `0x${string}`,
): Promise<T> {
  const client = getPublicClient();
  return client.readContract({
    address: contractAddress ?? CONTRACT_ADDRESS,
    abi: CIPHERBOOK_ABI,
    functionName: functionName as never,
    args: args as never,
    ...(account ? { account } : {}),
  }) as Promise<T>;
}

export async function writeContract(
  walletClient: WalletClient,
  functionName: string,
  args: unknown[],
  account: `0x${string}`,
  contractAddress?: `0x${string}`,
) {
  const publicClient = getPublicClient();

  const { request } = await publicClient.simulateContract({
    address: contractAddress ?? CONTRACT_ADDRESS,
    abi: CIPHERBOOK_ABI,
    functionName: functionName as never,
    args: args as never,
    account,
  });

  return walletClient.writeContract(request);
}

export async function readERC20<T>(
  tokenAddress: `0x${string}`,
  functionName: string,
  args: unknown[] = [],
): Promise<T> {
  const client = getPublicClient();
  return client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: functionName as never,
    args: args as never,
  }) as Promise<T>;
}

export async function writeERC20(
  walletClient: WalletClient,
  tokenAddress: `0x${string}`,
  functionName: string,
  args: unknown[],
  account: `0x${string}`,
) {
  const publicClient = getPublicClient();

  const { request } = await publicClient.simulateContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: functionName as never,
    args: args as never,
    account,
  });

  return walletClient.writeContract(request);
}

export { BASE_TOKEN_ADDRESS, QUOTE_TOKEN_ADDRESS, FACTORY_ADDRESS };
