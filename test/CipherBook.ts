import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { CipherBook, CipherBook__factory, MockERC20, MockERC20__factory } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const OrderSide   = { BUY: 0, SELL: 1 } as const;
const OrderStatus = { OPEN: 0, FILLED: 1, CANCELLED: 2 } as const;

// Token units used in tests (smallest unit, like wei).
// Base token has 18 decimals; contract scales amount*1e18 for transfers.
// Mint enough to cover ORDER_AMOUNT * 1e18 = 100 * 1e18 = 1e20 wei per signer.
const MINT_AMOUNT     = BigInt(2e21);           // 2000 TKN in wei — enough for 11+ orders in ring buffer test
const ORDER_AMOUNT    = 100n;                   // base token units per order
const ORDER_AMOUNT_WEI = ORDER_AMOUNT * BigInt(1e18); // wei transferred for ORDER_AMOUNT
const QUOTE_ESCROW    = 10_000n;               // quote tokens a buyer puts up (implied price = 100)

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

/** Encrypt a uint64 value as an fhEVM input for the given contract and user. */
async function encryptPrice(value: bigint, contractAddress: string, userAddress: string) {
  const encrypted = await fhevm
    .createEncryptedInput(contractAddress, userAddress)
    .add64(value)
    .encrypt();
  return { handle: encrypted.handles[0], proof: encrypted.inputProof };
}

/** User-decrypt the encrypted price of an order. */
async function decryptPrice(
  handle: string,
  contractAddress: string,
  user: HardhatEthersSigner,
): Promise<bigint> {
  return fhevm.userDecryptEuint(FhevmType.euint64, handle, contractAddress, user);
}

/**
 * Call fhevm.publicDecrypt on a settlement's encTradeQty handle, then submit the
 * KMS-signed proof to executeSettlement. Returns the transaction receipt.
 */
async function executeSettlement(contract: CipherBook, settlementId: bigint) {
  const settlement = await contract.getPendingSettlement(settlementId);
  const handle = settlement.encTradeQty; // bytes32

  // Fetch KMS-signed public decryption proof from the mock relayer.
  const result = await fhevm.publicDecrypt([handle]);

  // clearValues is keyed by the handle hex string; grab the single value.
  const clearVal = BigInt(Object.values(result.clearValues)[0] as bigint | string);

  const tx = await contract.executeSettlement(
    settlementId,
    clearVal,
    [handle],
    result.abiEncodedClearValues,
    result.decryptionProof,
  );
  return tx.wait();
}

/** Approve the CipherBook contract to spend tokens, then place a limit order. */
async function placeBuyOrder(
  contract: CipherBook,
  quoteToken: MockERC20,
  signer: HardhatEthersSigner,
  price: bigint,
  amount: bigint,
  quoteEscrow: bigint,
) {
  const addr = await contract.getAddress();
  await quoteToken.connect(signer).approve(addr, quoteEscrow);
  const enc = await encryptPrice(price, addr, signer.address);
  return contract.connect(signer).placeLimitOrder(
    OrderSide.BUY, enc.handle, enc.proof, amount, quoteEscrow,
  );
}

async function placeSellOrder(
  contract: CipherBook,
  baseToken: MockERC20,
  signer: HardhatEthersSigner,
  price: bigint,
  amount: bigint,
) {
  const addr = await contract.getAddress();
  // Contract scales by 1e18 internally, so approve the full wei amount
  await baseToken.connect(signer).approve(addr, amount * BigInt(1e18));
  const enc = await encryptPrice(price, addr, signer.address);
  return contract.connect(signer).placeLimitOrder(
    OrderSide.SELL, enc.handle, enc.proof, amount, 0n,
  );
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

async function deployFixture() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  const baseToken = await new MockERC20__factory(deployer).deploy(
    "CipherBook Token", "TKN", 18,
  );
  const quoteToken = await new MockERC20__factory(deployer).deploy(
    "CipherBook USD", "QUSD", 6,
  );

  const baseAddr  = await baseToken.getAddress();
  const quoteAddr = await quoteToken.getAddress();

  const contract = await new CipherBook__factory(deployer).deploy(baseAddr, quoteAddr);
  const contractAddress = await contract.getAddress();

  // Fund each signer with test tokens.
  for (const signer of signers.slice(0, 4)) {
    await baseToken.faucet(signer.address, MINT_AMOUNT);
    await quoteToken.faucet(signer.address, MINT_AMOUNT);
  }

  return { contract, contractAddress, baseToken, quoteToken };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("CipherBook", function () {
  let signers: Signers;
  let contract: CipherBook;
  let contractAddress: string;
  let baseToken: MockERC20;
  let quoteToken: MockERC20;

  before(async function () {
    const s = await ethers.getSigners();
    signers = { deployer: s[0], alice: s[1], bob: s[2], carol: s[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("CipherBook tests require mock fhEVM environment");
      this.skip();
    }
    ({ contract, contractAddress, baseToken, quoteToken } = await deployFixture());
  });

  // ─── Deployment ────────────────────────────────────────────────────────────

  describe("deployment", function () {
    it("stores the correct token addresses", async function () {
      expect(await contract.baseToken()).to.equal(await baseToken.getAddress());
      expect(await contract.quoteToken()).to.equal(await quoteToken.getAddress());
    });

    it("starts with zero orders and clean state", async function () {
      expect(await contract.nextOrderId()).to.equal(0n);
      expect(await contract.getOpenOrderCount()).to.equal(0n);
      expect(await contract.nextSettlementId()).to.equal(0n);

      const [lastPrice, volume, trades, openOrders] = await contract.getMarketSummary();
      expect(lastPrice).to.equal(0n);
      expect(volume).to.equal(0n);
      expect(trades).to.equal(0n);
      expect(openOrders).to.equal(0n);
    });
  });

  // ─── Token Faucet ──────────────────────────────────────────────────────────

  describe("MockERC20 faucet", function () {
    it("mints tokens to signers during setup", async function () {
      expect(await baseToken.balanceOf(signers.alice.address)).to.equal(MINT_AMOUNT);
      expect(await quoteToken.balanceOf(signers.bob.address)).to.equal(MINT_AMOUNT);
    });

    it("reverts when minting above the faucet limit", async function () {
      const limit = await baseToken.FAUCET_LIMIT();
      await expect(
        baseToken.faucet(signers.alice.address, limit + 1n),
      ).to.be.revertedWith("MockERC20: exceeds faucet limit");
    });
  });

  // ─── Place Order ───────────────────────────────────────────────────────────

  describe("placeLimitOrder", function () {
    it("escrows BaseToken when placing a SELL order", async function () {
      const contractAddr = await contract.getAddress();
      const balBefore = await baseToken.balanceOf(signers.bob.address);

      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      expect(await baseToken.balanceOf(signers.bob.address))
        .to.equal(balBefore - ORDER_AMOUNT_WEI);
      expect(await baseToken.balanceOf(contractAddr))
        .to.equal(ORDER_AMOUNT_WEI);

      const ids = await contract.connect(signers.bob).getMyOrderIds();
      const order = await contract.connect(signers.bob).getMyOrder(ids[0]);
      expect(order.escrowedTokens).to.equal(ORDER_AMOUNT_WEI);
      expect(order.amount).to.equal(ORDER_AMOUNT);
      expect(order.remainingAmount).to.equal(ORDER_AMOUNT);
    });

    it("escrows QuoteToken when placing a BUY order", async function () {
      const contractAddr = await contract.getAddress();
      const balBefore = await quoteToken.balanceOf(signers.alice.address);

      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);

      expect(await quoteToken.balanceOf(signers.alice.address))
        .to.equal(balBefore - QUOTE_ESCROW);
      expect(await quoteToken.balanceOf(contractAddr))
        .to.equal(QUOTE_ESCROW);

      const ids = await contract.connect(signers.alice).getMyOrderIds();
      const order = await contract.connect(signers.alice).getMyOrder(ids[0]);
      expect(order.escrowedTokens).to.equal(QUOTE_ESCROW);
    });

    it("reverts when placing a SELL without token approval", async function () {
      const enc = await encryptPrice(900n, contractAddress, signers.bob.address);
      await expect(
        contract.connect(signers.bob).placeLimitOrder(
          OrderSide.SELL, enc.handle, enc.proof, ORDER_AMOUNT, 0n,
        ),
      ).to.be.reverted;
    });

    it("reverts when placing a BUY with quoteEscrow = 0", async function () {
      const enc = await encryptPrice(1000n, contractAddress, signers.alice.address);
      await quoteToken.connect(signers.alice).approve(contractAddress, QUOTE_ESCROW);
      await expect(
        contract.connect(signers.alice).placeLimitOrder(
          OrderSide.BUY, enc.handle, enc.proof, ORDER_AMOUNT, 0n,
        ),
      ).to.be.revertedWith("CipherBook: quoteEscrow must be > 0 for BUY");
    });

    it("allows the owner to decrypt their own price", async function () {
      const clearPrice = 1234n;
      await placeSellOrder(contract, baseToken, signers.alice, clearPrice, ORDER_AMOUNT);

      const ids = await contract.connect(signers.alice).getMyOrderIds();
      const order = await contract.connect(signers.alice).getMyOrder(ids[0]);
      const decrypted = await decryptPrice(order.encryptedPrice, contractAddress, signers.alice);
      expect(decrypted).to.equal(clearPrice);
    });

    it("increments nextOrderId and open order count per order placed", async function () {
      await placeSellOrder(contract, baseToken, signers.alice, 900n, ORDER_AMOUNT);
      await placeBuyOrder(contract, quoteToken, signers.bob, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);

      expect(await contract.nextOrderId()).to.equal(2n);
      expect(await contract.getOpenOrderCount()).to.equal(2n);
    });
  });

  // ─── Cancel Order ──────────────────────────────────────────────────────────

  describe("cancelOrder", function () {
    it("returns BaseToken escrow when a SELL order is cancelled", async function () {
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);
      const balBefore = await baseToken.balanceOf(signers.bob.address);

      const ids = await contract.connect(signers.bob).getMyOrderIds();
      await contract.connect(signers.bob).cancelOrder(ids[0]);

      expect(await baseToken.balanceOf(signers.bob.address))
        .to.equal(balBefore + ORDER_AMOUNT_WEI);
      expect(await contract.getOpenOrderCount()).to.equal(0n);

      const order = await contract.connect(signers.bob).getMyOrder(ids[0]);
      expect(order.status).to.equal(OrderStatus.CANCELLED);
      expect(order.escrowedTokens).to.equal(0n);
    });

    it("returns QuoteToken escrow when a BUY order is cancelled", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      const balBefore = await quoteToken.balanceOf(signers.alice.address);

      const ids = await contract.connect(signers.alice).getMyOrderIds();
      await contract.connect(signers.alice).cancelOrder(ids[0]);

      expect(await quoteToken.balanceOf(signers.alice.address))
        .to.equal(balBefore + QUOTE_ESCROW);

      const order = await contract.connect(signers.alice).getMyOrder(ids[0]);
      expect(order.escrowedTokens).to.equal(0n);
    });

    it("reverts when a non-owner tries to cancel", async function () {
      await placeSellOrder(contract, baseToken, signers.alice, 900n, ORDER_AMOUNT);
      const ids = await contract.connect(signers.alice).getMyOrderIds();
      await expect(
        contract.connect(signers.bob).cancelOrder(ids[0]),
      ).to.be.revertedWith("CipherBook: not your order");
    });

    it("reverts when cancelling an already-cancelled order", async function () {
      await placeSellOrder(contract, baseToken, signers.alice, 900n, ORDER_AMOUNT);
      const ids = await contract.connect(signers.alice).getMyOrderIds();
      await contract.connect(signers.alice).cancelOrder(ids[0]);
      await expect(
        contract.connect(signers.alice).cancelOrder(ids[0]),
      ).to.be.revertedWith("CipherBook: order not open");
    });
  });

  // ─── Batch Matching + Settlement ──────────────────────────────────────────

  describe("runBatchMatch + executeSettlement", function () {
    it("queues a PendingSettlement and optimistically reduces remainingAmount", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      await contract.runBatchMatch();

      expect(await contract.nextSettlementId()).to.equal(1n);
      const settlementIds = await contract.getPendingSettlementIds();
      expect(settlementIds.length).to.equal(1);

      // Remaining amounts are optimistically reduced after runBatchMatch.
      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const aliceOrder = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      expect(aliceOrder.remainingAmount).to.equal(0n);
    });

    it("executes settlement and transfers tokens when prices cross", async function () {
      // Alice: BUY 100 @ price 1000, escrows 10_000 QUSD
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      // Bob: SELL 100 @ price 900 — buyPrice (1000) >= sellPrice (900) → match
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      const aliceQBefore = await quoteToken.balanceOf(signers.alice.address);
      const aliceBBefore = await baseToken.balanceOf(signers.alice.address);
      const bobBBefore   = await baseToken.balanceOf(signers.bob.address);
      const bobQBefore   = await quoteToken.balanceOf(signers.bob.address);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      // Alice should have received ORDER_AMOUNT BaseToken.
      expect(await baseToken.balanceOf(signers.alice.address))
        .to.equal(aliceBBefore + ORDER_AMOUNT_WEI);

      // Bob should have received QUOTE_ESCROW QuoteToken.
      expect(await quoteToken.balanceOf(signers.bob.address))
        .to.equal(bobQBefore + QUOTE_ESCROW);

      // Alice's quote balance is unchanged (she paid from escrow, not directly).
      expect(await quoteToken.balanceOf(signers.alice.address)).to.equal(aliceQBefore);

      // Bob's base balance is unchanged (he paid from escrow, not directly).
      expect(await baseToken.balanceOf(signers.bob.address)).to.equal(bobBBefore);

      // Market summary updated.
      const [lastPrice, volume, trades] = await contract.getMarketSummary();
      expect(volume).to.equal(ORDER_AMOUNT);
      expect(trades).to.equal(1n);
      expect(lastPrice).to.be.gt(0n);

      // Settlement removed from pending list.
      const ids = await contract.getPendingSettlementIds();
      expect(ids.length).to.equal(0);
    });

    it("reverses optimistic reduction when prices do not cross", async function () {
      // Alice: BUY 100 @ price 800 — below Bob's sell price, no match
      await placeBuyOrder(contract, quoteToken, signers.alice, 800n, ORDER_AMOUNT, QUOTE_ESCROW);
      // Bob:   SELL 100 @ price 1000
      await placeSellOrder(contract, baseToken, signers.bob, 1000n, ORDER_AMOUNT);

      await contract.runBatchMatch();

      // After runBatchMatch, remaining amounts are optimistically zero.
      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const aliceOrderMid = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      expect(aliceOrderMid.remainingAmount).to.equal(0n);

      await executeSettlement(contract, 0n);

      // After executeSettlement reveals no match, remaining amounts are restored.
      const aliceOrderAfter = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      expect(aliceOrderAfter.remainingAmount).to.equal(ORDER_AMOUNT);

      const bobIds = await contract.connect(signers.bob).getMyOrderIds();
      const bobOrderAfter = await contract.connect(signers.bob).getMyOrder(bobIds[0]);
      expect(bobOrderAfter.remainingAmount).to.equal(ORDER_AMOUNT);

      // No tokens transferred.
      expect(await baseToken.balanceOf(signers.alice.address)).to.equal(MINT_AMOUNT);
      expect(await quoteToken.balanceOf(signers.bob.address)).to.equal(MINT_AMOUNT);
    });

    it("matches at exactly equal prices", async function () {
      const price = 1000n;
      await placeBuyOrder(contract, quoteToken, signers.alice, price, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, price, ORDER_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const aliceOrder = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      expect(aliceOrder.remainingAmount).to.equal(0n);

      expect(await baseToken.balanceOf(signers.alice.address))
        .to.equal(MINT_AMOUNT + ORDER_AMOUNT_WEI);
    });

    it("partially matches when amounts differ and settles correctly", async function () {
      const SELL_AMOUNT = 40n;
      const SELL_QUOTE  = (QUOTE_ESCROW * SELL_AMOUNT) / ORDER_AMOUNT; // proportional
      // Alice: BUY 100 units. Bob: SELL 40 units — 40 traded, 60 remain for Alice.
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, SELL_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      // Alice received 40 base tokens.
      expect(await baseToken.balanceOf(signers.alice.address))
        .to.equal(MINT_AMOUNT + SELL_AMOUNT * BigInt(1e18));

      // Bob received the proportional quote (40/100 of QUOTE_ESCROW).
      expect(await quoteToken.balanceOf(signers.bob.address))
        .to.equal(MINT_AMOUNT + SELL_QUOTE);

      // Alice's buy order has 60 remaining.
      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const aliceOrder = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      expect(aliceOrder.remainingAmount).to.equal(ORDER_AMOUNT - SELL_AMOUNT);
    });

    it("reverts when submitting an already-executed settlement", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      // Try to execute the same settlement again.
      const settlement = await contract.getPendingSettlement(0n);
      const handle = settlement.encTradeQty;
      const result = await fhevm.publicDecrypt([handle]);
      const clearVal = BigInt(Object.values(result.clearValues)[0] as bigint | string);

      await expect(
        contract.executeSettlement(
          0n, clearVal, [handle],
          result.abiEncodedClearValues, result.decryptionProof,
        ),
      ).to.be.revertedWith("CipherBook: already executed");
    });

    it("increments totalTradesExecuted only for real trades", async function () {
      // Matching pair — real trade.
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);
      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      const [, , tradesAfterMatch] = await contract.getMarketSummary();
      expect(tradesAfterMatch).to.equal(1n);

      // Non-matching pair — no trade.
      await placeBuyOrder(contract, quoteToken, signers.carol, 500n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);
      await contract.runBatchMatch();
      await executeSettlement(contract, 1n);

      const [, , tradesAfterNoMatch] = await contract.getMarketSummary();
      expect(tradesAfterNoMatch).to.equal(1n); // unchanged
    });
  });

  // ─── markFilled + withdrawUnusedEscrow ────────────────────────────────────

  describe("markFilled + withdrawUnusedEscrow", function () {
    it("orders are auto-filled after full settlement; markFilled is a no-op fallback", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      // Auto-fill already set status to FILLED — markFilled should revert with "not open".
      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const aliceOrder = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      expect(aliceOrder.status).to.equal(OrderStatus.FILLED);

      await expect(
        contract.connect(signers.alice).markFilled(aliceIds[0]),
      ).to.be.revertedWith("CipherBook: order not open");
    });

    it("reverts markFilled when remaining amount is not zero", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      const ids = await contract.connect(signers.alice).getMyOrderIds();

      await expect(
        contract.connect(signers.alice).markFilled(ids[0]),
      ).to.be.revertedWith("CipherBook: order not fully matched");
    });

    it("allows withdrawing unused quote escrow after fill", async function () {
      // Partial fill: buyer escrowed for 100 units, only 40 filled.
      const SELL_AMOUNT = 40n;
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, SELL_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      // Cancel the remaining BUY so we can mark it via cancel (remaining > 0).
      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const balBefore = await quoteToken.balanceOf(signers.alice.address);
      await contract.connect(signers.alice).cancelOrder(aliceIds[0]);

      // On cancel the remaining escrow is returned.
      const balAfter = await quoteToken.balanceOf(signers.alice.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("reverts withdrawUnusedEscrow for an OPEN order", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      const ids = await contract.connect(signers.alice).getMyOrderIds();

      await expect(
        contract.connect(signers.alice).withdrawUnusedEscrow(ids[0]),
      ).to.be.revertedWith("CipherBook: order must be filled or cancelled first");
    });
  });

  // ─── Auto-mark filled ─────────────────────────────────────────────────────

  describe("auto-mark filled", function () {
    it("automatically marks both orders FILLED after a full match settles", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const bobIds   = await contract.connect(signers.bob).getMyOrderIds();

      const aliceOrder = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      const bobOrder   = await contract.connect(signers.bob).getMyOrder(bobIds[0]);

      expect(aliceOrder.status).to.equal(OrderStatus.FILLED);
      expect(bobOrder.status).to.equal(OrderStatus.FILLED);
    });

    it("does not auto-mark an order FILLED if it is only partially filled", async function () {
      const SELL_AMOUNT = 50n;
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, SELL_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      // Alice's BUY still has 50 remaining — should stay OPEN.
      const aliceIds  = await contract.connect(signers.alice).getMyOrderIds();
      const aliceOrder = await contract.connect(signers.alice).getMyOrder(aliceIds[0]);
      expect(aliceOrder.status).to.equal(OrderStatus.OPEN);
      expect(aliceOrder.remainingAmount).to.equal(ORDER_AMOUNT - SELL_AMOUNT);

      // Bob's SELL was fully consumed — should be FILLED.
      const bobIds  = await contract.connect(signers.bob).getMyOrderIds();
      const bobOrder = await contract.connect(signers.bob).getMyOrder(bobIds[0]);
      expect(bobOrder.status).to.equal(OrderStatus.FILLED);
    });

    it("auto-filled orders are removed from the open order list", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      expect(await contract.getOpenOrderCount()).to.equal(2n);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      expect(await contract.getOpenOrderCount()).to.equal(0n);
    });
  });

  // ─── Recent trade history ──────────────────────────────────────────────────

  describe("getRecentTrades", function () {
    it("returns an empty array before any trades", async function () {
      const trades = await contract.getRecentTrades();
      expect(trades.length).to.equal(0);
    });

    it("records a trade after a successful settlement", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      const trades = await contract.getRecentTrades();
      expect(trades.length).to.equal(1);
      expect(trades[0].qty).to.equal(ORDER_AMOUNT);
      expect(trades[0].price).to.be.gt(0n);
      expect(trades[0].timestamp).to.be.gt(0n);
    });

    it("does not record a no-match settlement", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 500n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      await contract.runBatchMatch();
      await executeSettlement(contract, 0n);

      const trades = await contract.getRecentTrades();
      expect(trades.length).to.equal(0);
    });

    it("retains up to 10 trades and wraps the ring buffer correctly", async function () {
      // Place and settle 11 trades; the ring holds only the last 10.
      for (let i = 0; i < 11; i++) {
        await quoteToken.connect(signers.alice).approve(await contract.getAddress(), QUOTE_ESCROW);
        await baseToken.connect(signers.bob).approve(await contract.getAddress(), ORDER_AMOUNT_WEI);

        const encBuy  = await encryptPrice(1000n, contractAddress, signers.alice.address);
        const encSell = await encryptPrice(900n,  contractAddress, signers.bob.address);

        await contract.connect(signers.alice).placeLimitOrder(
          OrderSide.BUY, encBuy.handle, encBuy.proof, ORDER_AMOUNT, QUOTE_ESCROW,
        );
        await contract.connect(signers.bob).placeLimitOrder(
          OrderSide.SELL, encSell.handle, encSell.proof, ORDER_AMOUNT, 0n,
        );

        await contract.runBatchMatch();
        const settlementId = BigInt(i);
        await executeSettlement(contract, settlementId);
      }

      const trades = await contract.getRecentTrades();
      expect(trades.length).to.equal(10);
      // All entries should have valid data.
      for (const t of trades) {
        expect(t.qty).to.equal(ORDER_AMOUNT);
        expect(t.price).to.be.gt(0n);
      }
    });
  });

  // ─── Access Control ────────────────────────────────────────────────────────

  describe("access control", function () {
    it("reverts when a user tries to read another user's order", async function () {
      await placeSellOrder(contract, baseToken, signers.alice, 900n, ORDER_AMOUNT);
      const ids = await contract.connect(signers.alice).getMyOrderIds();

      await expect(
        contract.connect(signers.bob).getMyOrder(ids[0]),
      ).to.be.revertedWith("CipherBook: not your order");
    });

    it("getMyOrderIds returns only the caller's orders", async function () {
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeBuyOrder(contract, quoteToken, signers.alice, 1000n, ORDER_AMOUNT, QUOTE_ESCROW);
      await placeSellOrder(contract, baseToken, signers.bob, 900n, ORDER_AMOUNT);

      const aliceIds = await contract.connect(signers.alice).getMyOrderIds();
      const bobIds   = await contract.connect(signers.bob).getMyOrderIds();

      expect(aliceIds.length).to.equal(2);
      expect(bobIds.length).to.equal(1);
    });
  });
});
