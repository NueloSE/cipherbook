<div align="center">
  <img src="assets/icon.svg" width="96" height="96" alt="CipherBook" />
  <h1>CipherBook</h1>
  <p><strong>A fully encrypted limit order book DEX on Zama's fhEVM.</strong><br/>
  Every order price is protected by Fully Homomorphic Encryption — matched on-chain without ever being revealed.<br/>
  MEV and front-running are cryptographically impossible.</p>
  <p>
    <img src="https://img.shields.io/badge/Zama%20Developer%20Program-Season%202-6366f1?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHJ4PSIzIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==" alt="Zama Developer Program Season 2"/>
    <img src="https://img.shields.io/badge/Network-Sepolia%20Testnet-8b5cf6?style=flat-square" alt="Sepolia"/>
    <img src="https://img.shields.io/badge/fhEVM-v0.11-4f46e5?style=flat-square" alt="fhEVM v0.11"/>
    <img src="https://img.shields.io/badge/Tests-27%20passing-22c55e?style=flat-square" alt="Tests"/>
  </p>
</div>

---

Built for the **Zama Developer Program Mainnet Season 2 — Builder Track**.

---

## Live Demo

**[https://cipherbook-red.vercel.app](https://cipherbook-red.vercel.app)** *(Sepolia testnet — connect MetaMask)*

> Use the built-in Token Faucet to get test TKN and QUSD, then place orders on the TKN/QUSD pair.

---

## The Problem

On every existing DEX, order prices are visible on-chain before they are filled. MEV bots exploit this by:

- **Front-running** — seeing your buy order, buying first to push the price up, then selling back to you at a profit
- **Sandwich attacks** — surrounding your transaction with buys and sells to extract value
- **Back-running** — reacting to your large order to profit from the predictable price move

This costs DeFi traders an estimated **$1B+ per year** — a structural tax on every participant that standard cryptography cannot solve because blockchains require transparent execution.

---

## The Solution

CipherBook keeps all order prices encrypted using **Fully Homomorphic Encryption (FHE)**. The smart contract compares two encrypted prices and determines if they cross — without decrypting either one.

A bot watching the mempool sees: *"an order exists."* It cannot see the price. It cannot front-run what it cannot read.

```
Traditional DEX:   price visible in mempool → MEV bot reads it → front-runs you
CipherBook:        price is a ciphertext    → MEV bot sees noise → nothing to exploit
```

---

## How It Works (User Flow)

1. **Get tokens** — Use the Token Faucet to receive test TKN and QUSD on Sepolia
2. **Place a limit order** — Enter your amount and price. The browser encrypts the price using FHE before it ever leaves your machine. Your wallet signs the encrypted input proof (no gas for this step).
3. **Order lives on-chain** — The contract stores your encrypted price as a `euint64` ciphertext. No one can read it — not even Zama.
4. **Batch matching** — Anyone calls `runBatchMatch()`. The contract uses `FHE.ge(buyPrice, sellPrice)` to compare encrypted prices homomorphically. If they cross, the trade quantity is encrypted and registered with the KMS.
5. **KMS settlement** — Zama's Key Management Service decrypts only the trade quantity (not the prices) and returns a signed proof. `executeSettlement()` verifies the proof on-chain and transfers tokens.
6. **View your orders** — Click "Decrypt & Load" in My Orders. Your wallet signs an EIP-712 message (free, off-chain). The SDK uses your private key to decrypt your own order prices locally.

---

## Architecture

```
User's Browser                    Sepolia fhEVM                    Zama KMS
─────────────────────────────────────────────────────────────────────────────

encrypt(price) ──────────────────► CipherBook.placeLimitOrder()
                                   stores euint64 encryptedPrice
                                   escrowed tokens locked in contract

                                   runBatchMatch()
                                   ├─ FHE.ge(buyPrice, sellPrice)     ← encrypted compare
                                   ├─ FHE.select(match, qty, 0)       ← encrypted branch
                                   ├─ FHE.makePubliclyDecryptable()   ← register with KMS
                                   └─ stores PendingSettlement

                                                                       KMS auto-decrypts
                                                                       produces signed proof

                                   executeSettlement()  ◄────────────  { clearValue,
                                   ├─ FHE.checkSignatures()              abiEncodedCleartexts,
                                   ├─ if qty > 0: transfer tokens        decryptionProof }
                                   └─ if qty == 0: reverse optimistic reductions

User (view own price)
  ├─ EIP-712 signature (free)
  └─ fhevm.userDecrypt() ─────────────────────────────────────────────► local decrypt
```

### Key Design Decisions

| Decision | Reasoning |
|----------|-----------|
| **Price encrypted, amount plaintext** | Amount must be plaintext for escrow math. Price is the only field needed for MEV prevention. |
| **Pull-pattern decryption** | `makePubliclyDecryptable` + `checkSignatures` is the correct decryption pattern in `@fhevm/solidity v0.11`. The KMS relayer on Zama's Sepolia testnet processes these automatically. |
| **BUY price derived from escrow** | The encrypted BUY price is `floor(quoteEscrow / amount)` — tying the encrypted value to actual payment and closing any price/escrow mismatch exploit. |
| **Optimistic reduction** | `_tryMatch` decrements `remainingAmount` immediately. `executeSettlement` reverses this if the decrypted quantity is 0. Prevents double-counting across concurrent pending settlements. |
| **Partial-fill price consistency** | `quoteAmount = (tradeQty × escrow) / (remainingAmount + tradeQty)` reconstructs "remaining before this trade" as denominator, keeping per-unit price consistent across multiple partial fills. |
| **Checks-Effects-Interactions** | `escrowedTokens = 0` and `executed = true` are set before any token transfers to prevent reentrancy. `nonReentrant` modifier applied throughout. |
| **Auto-mark filled** | `executeSettlement` automatically sets status to FILLED when `remainingAmount == 0`, removing the need for a manual call in the common case. |
| **Factory pattern** | `CipherBookFactory` deploys a new encrypted order book for any ERC-20 pair permissionlessly. |

---

## FHE Operations Used

| Operation | Where | Purpose |
|-----------|-------|---------|
| `FHE.fromExternal()` | `placeLimitOrder` | Deserialise the client-side encrypted price into a contract-side `euint64` with ZK proof verification |
| `FHE.allowThis()` | `placeLimitOrder`, `_tryMatch` | Grant the contract permission to use the ciphertext in future computations |
| `FHE.allow(price, owner)` | `placeLimitOrder` | Grant the order owner permission to decrypt their own price via EIP-712 |
| `FHE.ge(buyPrice, sellPrice)` | `_tryMatch` | Encrypted greater-than-or-equal comparison — the core matching operation, result is an `ebool` |
| `FHE.asEuint64(tradeQty)` | `_tryMatch` | Lift a plaintext quantity into encrypted space for the conditional select |
| `FHE.select(match, qty, zero)` | `_tryMatch` | Encrypted conditional — result is `qty` if prices crossed, else encrypted `0` |
| `FHE.makePubliclyDecryptable()` | `_tryMatch`, `markFilled` | Register ciphertext with the KMS for public decryption; produces a signed proof |
| `FHE.checkSignatures()` | `executeSettlement` | Verify the KMS cryptographic proof on-chain — reverts if the proof is forged or tampered |

**8 distinct FHE operations** across the core matching and settlement pipeline.

---

## Privacy Guarantees

| Data | Visibility |
|------|------------|
| That an order exists | Public |
| Order side (BUY / SELL) | Public |
| Order amount (TKN) | Public — required for token escrow |
| **Order price** | **Encrypted** — only the owner can decrypt theirs via EIP-712 signature |
| Whether a specific pair's prices crossed | Encrypted until KMS proof is submitted |
| Settlement quantity | Public (after KMS decryption and settlement) |
| Who traded with whom | Public (after settlement) |

---

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| `CipherBook.sol` | Core encrypted order book — one instance per trading pair |
| `CipherBookFactory.sol` | Deploys and indexes `CipherBook` instances for any ERC-20 pair permissionlessly |
| `MockERC20.sol` | Testnet token with a public faucet (no auth — for demo purposes) |

### Key Parameters

```solidity
MAX_BATCH_PAIRS   = 50   // Max BUY×SELL pairs evaluated per runBatchMatch() call
MAX_RECENT_TRADES = 10   // Recent trade history ring buffer size
```

---

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| CipherBookFactory | [`0x25fba8FD994fcd72b71315e35dc9992ca1FE4F43`](https://sepolia.etherscan.io/address/0x25fba8FD994fcd72b71315e35dc9992ca1FE4F43) |
| CipherBook (TKN/QUSD) | [`0x1369BAb501257C419d578d711331D79E27599472`](https://sepolia.etherscan.io/address/0x1369BAb501257C419d578d711331D79E27599472) |
| BaseToken (TKN) | [`0x5dd3C7270ab16049946863036F7c54715bc3ECb2`](https://sepolia.etherscan.io/address/0x5dd3C7270ab16049946863036F7c54715bc3ECb2) |
| QuoteToken (QUSD) | [`0x985Ab56DEbaAd5117f6D6cAc63cD1FaE94993A84`](https://sepolia.etherscan.io/address/0x985Ab56DEbaAd5117f6D6cAc63cD1FaE94993A84) |

---

## Local Development

### Prerequisites

- Node.js 18+
- MetaMask with Sepolia ETH ([faucet](https://sepoliafaucet.com))

### Setup

```bash
# Clone and install
git clone https://github.com/nuelo/cipherbook
cd cipherbook
npm install

# Run tests against local fhEVM node
npm run chain          # terminal 1 — starts local Zama fhEVM node
npx hardhat test       # terminal 2 — runs 27 tests

# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Copy addresses into frontend config
# Update CONTRACT_ADDRESS, BASE_TOKEN_ADDRESS, QUOTE_TOKEN_ADDRESS, FACTORY_ADDRESS
# in frontend/src/lib/config.ts

# Start frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Environment Variables

```bash
# .env (root)
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0x...          # deployer wallet private key

# frontend/.env.local
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

---

## Testing

```bash
npx hardhat test
```

27 tests covering:

- Token escrow on order placement (SELL escrows TKN, BUY escrows QUSD)
- Escrow return on cancellation
- Batch matching and settlement (match, no-match, partial fills, equal prices)
- Partial-fill price consistency across multiple fills of the same order
- Auto-mark-filled after full settlement
- Recent trade history ring buffer (10-slot circular buffer)
- Withdraw unused escrow after fill or cancellation
- Access control (owner-only reads, cancel, withdraw)

---

## Known Limitations

- **O(n²) matching**: `runBatchMatch` evaluates all BUY×SELL combinations up to `MAX_BATCH_PAIRS = 50`. Appropriate for a testnet demo. A production deployment would run an off-chain matching engine that submits only crossed pairs on-chain, keeping gas costs constant.

- **No price-time priority**: Ordering within a price level is by storage insertion order. True price-time priority with encrypted prices is an open research problem — encrypted values cannot be sorted without revealing them.

- **Automated keeper on Vercel**: A `/api/keeper` cron route runs `runBatchMatch()` every minute using a funded keeper wallet (`KEEPER_PRIVATE_KEY` env var). Requires Vercel Pro for sub-hourly cron intervals; on Hobby, set the schedule to `0 * * * *` (hourly) or use an external service like [cron-job.org](https://cron-job.org) to hit the endpoint.

---

## Built With

<table>
<tr>
<td align="center" width="120">
<img src="https://github.com/zama-ai.png" width="48" height="48" style="border-radius:8px" alt="Zama"/><br/>
<strong>Zama fhEVM</strong><br/>
<sub>@fhevm/solidity v0.11</sub>
</td>
<td align="center" width="120">
<img src="https://hardhat.org/favicon.ico" width="48" height="48" alt="Hardhat"/><br/>
<strong>Hardhat</strong><br/>
<sub>+ hardhat-deploy</sub>
</td>
<td align="center" width="120">
<img src="https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/master/logo.svg" width="48" height="48" alt="OpenZeppelin"/><br/>
<strong>OpenZeppelin</strong><br/>
<sub>Contracts v5</sub>
</td>
<td align="center" width="120">
<img src="https://nextjs.org/favicon.ico" width="48" height="48" alt="Next.js"/><br/>
<strong>Next.js 15</strong><br/>
<sub>+ Tailwind CSS</sub>
</td>
<td align="center" width="120">
<img src="https://viem.sh/favicons/favicon.ico" width="48" height="48" alt="viem"/><br/>
<strong>viem + wagmi</strong><br/>
<sub>Ethereum client</sub>
</td>
</tr>
</table>
