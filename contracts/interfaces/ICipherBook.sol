// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

interface ICipherBook {
    // ─── Enums ────────────────────────────────────────────────────────────────

    enum OrderSide {
        BUY,  // buyer escrowing QuoteToken, wants BaseToken
        SELL  // seller escrowing BaseToken, wants QuoteToken
    }

    enum OrderStatus {
        OPEN,
        FILLED,
        CANCELLED
    }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Order {
        uint256 id;
        address owner;
        OrderSide side;
        euint64 encryptedPrice;
        uint64 amount;
        uint64 remainingAmount;
        uint256 escrowedTokens;
        OrderStatus status;
        uint256 timestamp;
    }

    struct PendingSettlement {
        uint256 id;
        uint256 buyOrderId;
        uint256 sellOrderId;
        uint64 tradeQty;
        euint64 encTradeQty;
        bool executed;
    }

    struct TradeRecord {
        uint64  qty;
        uint256 price;
        uint256 timestamp;
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed owner,
        OrderSide side,
        uint64 amount,
        uint256 timestamp
    );

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed owner,
        uint256 escrowReturned
    );

    event OrderFilled(uint256 indexed orderId);

    event BatchMatchRun(uint256 timestamp, uint256 openOrderCount, uint256 settlementsQueued);

    event SettlementQueued(
        uint256 indexed settlementId,
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint64 tradeQty
    );

    event TradeSettled(
        uint256 indexed settlementId,
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint64 tradeQty,
        uint256 quoteAmount
    );

    event NoMatch(
        uint256 indexed settlementId,
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId
    );

    event EscrowReturned(uint256 indexed orderId, address indexed owner, uint256 amount);

    // ─── Mutating Functions ────────────────────────────────────────────────────

    function placeLimitOrder(
        OrderSide side,
        bytes32 encryptedPrice,
        bytes calldata priceProof,
        uint64 amount,
        uint256 quoteEscrow
    ) external;

    function cancelOrder(uint256 orderId) external;

    function runBatchMatch() external;

    function executeSettlement(
        uint256 settlementId,
        uint64 decryptedTradeQty,
        bytes32[] calldata handlesList,
        bytes calldata abiEncodedCleartexts,
        bytes calldata decryptionProof
    ) external;

    function markFilled(uint256 orderId) external;

    function withdrawUnusedEscrow(uint256 orderId) external;

    // ─── View Functions ────────────────────────────────────────────────────────

    function getMyOrder(uint256 orderId) external view returns (Order memory);

    function getMyOrderIds() external view returns (uint256[] memory);

    function getPendingSettlement(uint256 settlementId) external view returns (PendingSettlement memory);

    function getPendingSettlementIds() external view returns (uint256[] memory);

    function getOpenOrderCount() external view returns (uint256);

    function getMarketSummary()
        external
        view
        returns (
            uint256 lastTradedPrice,
            uint256 totalVolume,
            uint256 totalTrades,
            uint256 openOrders
        );

    function getRecentTrades() external view returns (TradeRecord[] memory);
}
