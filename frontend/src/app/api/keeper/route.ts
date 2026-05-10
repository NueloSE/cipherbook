import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { CIPHERBOOK_ABI } from "@/lib/contract";
import { CONTRACT_ADDRESS, SEPOLIA_RPC_URL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const rawKey = process.env.KEEPER_PRIVATE_KEY;
  if (!rawKey) {
    return Response.json({ error: "KEEPER_PRIVATE_KEY not configured" }, { status: 500 });
  }

  // Ensure key has 0x prefix
  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const transport = http(SEPOLIA_RPC_URL);
    const publicClient = createPublicClient({ chain: sepolia, transport });
    const walletClient = createWalletClient({ account, chain: sepolia, transport });

    const openCount = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: CIPHERBOOK_ABI,
      functionName: "getOpenOrderCount",
    })) as bigint;

    if (openCount < 2n) {
      return Response.json({
        skipped: true,
        reason: `only ${openCount} open order(s)`,
        contract: CONTRACT_ADDRESS,
        keeper: account.address,
      });
    }

    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CIPHERBOOK_ABI,
      functionName: "runBatchMatch",
      args: [],
    });

    console.log("[keeper] runBatchMatch tx:", hash);
    return Response.json({ success: true, hash, openOrders: openCount.toString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[keeper] error:", message);
    return Response.json(
      { error: message, contract: CONTRACT_ADDRESS, rpc: SEPOLIA_RPC_URL },
      { status: 500 }
    );
  }
}
