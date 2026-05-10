// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICipherBook} from "./interfaces/ICipherBook.sol";

contract CipherBook is ZamaEthereumConfig, ICipherBook, ReentrancyGuard {
    uint256 public constant MAX_BATCH_PAIRS = 50;
    uint256 private constant MAX_RECENT_TRADES = 10;

    IERC20 public immutable baseToken;
    IERC20 public immutable quoteToken;

    uint256 public nextOrderId;
    mapping(uint256 => Order) private _orders;
    mapping(address => uint256[]) private _userOrderIds;
    uint256[] private _openOrderIds;

    uint256 public nextSettlementId;
    mapping(uint256 => PendingSettlement) private _pendingSettlements;
    uint256[] private _pendingSettlementIds;

    euint64 private _encryptedZero;
    bool private _encryptedZeroInitialized;

    uint256 public lastTradedPrice;
    uint256 public totalVolumeTraded;
    uint256 public totalTradesExecuted;

    TradeRecord[10] private _tradeRing;
    uint8 private _tradeRingNext;
    uint8 private _tradeRingCount;

    constructor(address _baseToken, address _quoteToken) {
        require(_baseToken != address(0), "CipherBook: invalid base token");
        require(_quoteToken != address(0), "CipherBook: invalid quote token");
        require(_baseToken != _quoteToken, "CipherBook: tokens must differ");
        baseToken = IERC20(_baseToken);
        quoteToken = IERC20(_quoteToken);
    }

    function placeLimitOrder(
        OrderSide side,
        bytes32 encryptedPrice,
        bytes calldata priceProof,
        uint64 amount,
        uint256 quoteEscrow
    ) external nonReentrant {
        require(amount > 0, "CipherBook: amount must be > 0");

        uint256 escrowed;
        if (side == OrderSide.SELL) {
            escrowed = uint256(amount) * 1e18;
            baseToken.transferFrom(msg.sender, address(this), escrowed);
        } else {
            require(quoteEscrow > 0, "CipherBook: quoteEscrow must be > 0 for BUY");
            escrowed = quoteEscrow;
            quoteToken.transferFrom(msg.sender, address(this), escrowed);
        }

        euint64 price = FHE.fromExternal(externalEuint64.wrap(encryptedPrice), priceProof);
        uint256 orderId = nextOrderId++;

        _orders[orderId] = Order({
            id: orderId,
            owner: msg.sender,
            side: side,
            encryptedPrice: price,
            amount: amount,
            remainingAmount: amount,
            escrowedTokens: escrowed,
            status: OrderStatus.OPEN,
            timestamp: block.timestamp
        });

        FHE.allowThis(price);
        FHE.allow(price, msg.sender);
        _userOrderIds[msg.sender].push(orderId);
        _openOrderIds.push(orderId);

        emit OrderPlaced(orderId, msg.sender, side, amount, block.timestamp);
    }

    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];
        require(order.owner == msg.sender, "CipherBook: not your order");
        require(order.status == OrderStatus.OPEN, "CipherBook: order not open");

        order.status = OrderStatus.CANCELLED;
        _removeFromOpenOrders(orderId);

        uint256 toReturn = order.escrowedTokens;
        if (toReturn > 0) {
            order.escrowedTokens = 0;
            if (order.side == OrderSide.SELL) {
                baseToken.transfer(order.owner, toReturn);
            } else {
                quoteToken.transfer(order.owner, toReturn);
            }
            emit EscrowReturned(orderId, order.owner, toReturn);
        }
        emit OrderCancelled(orderId, msg.sender, toReturn);
    }

    function runBatchMatch() external {
        uint256 len = _openOrderIds.length;
        uint256 pairsEvaluated = 0;
        uint256 settlementsQueued = 0;

        for (uint256 i = 0; i < len && pairsEvaluated < MAX_BATCH_PAIRS; i++) {
            Order storage buyOrder = _orders[_openOrderIds[i]];
            if (buyOrder.side != OrderSide.BUY) continue;
            if (buyOrder.status != OrderStatus.OPEN) continue;
            if (buyOrder.remainingAmount == 0) continue;

            for (uint256 j = 0; j < len && pairsEvaluated < MAX_BATCH_PAIRS; j++) {
                if (i == j) continue;
                Order storage sellOrder = _orders[_openOrderIds[j]];
                if (sellOrder.side != OrderSide.SELL) continue;
                if (sellOrder.status != OrderStatus.OPEN) continue;
                if (sellOrder.remainingAmount == 0) continue;

                _tryMatch(buyOrder, sellOrder);
                pairsEvaluated++;
                settlementsQueued++;
            }
        }

        emit BatchMatchRun(block.timestamp, len, settlementsQueued);
    }

    function _tryMatch(Order storage buyOrder, Order storage sellOrder) internal {
        ebool priceMatches = FHE.ge(buyOrder.encryptedPrice, sellOrder.encryptedPrice);

        uint64 tradeQty = buyOrder.remainingAmount < sellOrder.remainingAmount
            ? buyOrder.remainingAmount
            : sellOrder.remainingAmount;

        if (!_encryptedZeroInitialized) {
            _encryptedZero = FHE.asEuint64(0);
            FHE.allowThis(_encryptedZero);
            _encryptedZeroInitialized = true;
        }

        euint64 encTradeQty = FHE.select(priceMatches, FHE.asEuint64(tradeQty), _encryptedZero);
        encTradeQty = FHE.makePubliclyDecryptable(encTradeQty);
        FHE.allowThis(encTradeQty);

        buyOrder.remainingAmount -= tradeQty;
        sellOrder.remainingAmount -= tradeQty;

        uint256 settlementId = nextSettlementId++;
        _pendingSettlements[settlementId] = PendingSettlement({
            id: settlementId,
            buyOrderId: buyOrder.id,
            sellOrderId: sellOrder.id,
            tradeQty: tradeQty,
            encTradeQty: encTradeQty,
            executed: false
        });
        _pendingSettlementIds.push(settlementId);

        emit SettlementQueued(settlementId, buyOrder.id, sellOrder.id, tradeQty);
    }

    function executeSettlement(
        uint256 settlementId,
        uint64 decryptedTradeQty,
        bytes32[] calldata handlesList,
        bytes calldata abiEncodedCleartexts,
        bytes calldata decryptionProof
    ) external nonReentrant {
        PendingSettlement storage settlement = _pendingSettlements[settlementId];
        require(!settlement.executed, "CipherBook: already executed");
        require(handlesList.length == 1, "CipherBook: expected exactly 1 handle");
        require(
            handlesList[0] == euint64.unwrap(settlement.encTradeQty),
            "CipherBook: handle mismatch"
        );

        FHE.checkSignatures(handlesList, abiEncodedCleartexts, decryptionProof);

        uint256 decodedClear = abi.decode(abiEncodedCleartexts, (uint256));
        require(uint64(decodedClear) == decryptedTradeQty, "CipherBook: decrypted value mismatch");

        settlement.executed = true;
        _removeFromPendingSettlements(settlementId);

        Order storage buyOrder  = _orders[settlement.buyOrderId];
        Order storage sellOrder = _orders[settlement.sellOrderId];

        if (decryptedTradeQty > 0) {
            // Denominator = remainingAmount + decryptedTradeQty reconstructs
            // "remaining before this trade" because _tryMatch already decremented
            // remainingAmount optimistically. This keeps per-unit price consistent.
            uint256 quoteAmount = (uint256(decryptedTradeQty) * buyOrder.escrowedTokens)
                / (uint256(buyOrder.remainingAmount) + uint256(decryptedTradeQty));

            buyOrder.escrowedTokens  -= quoteAmount;
            sellOrder.escrowedTokens -= uint256(decryptedTradeQty) * 1e18;

            lastTradedPrice    = quoteAmount / uint256(decryptedTradeQty);
            totalVolumeTraded += uint256(decryptedTradeQty);
            totalTradesExecuted++;

            _recordTrade(decryptedTradeQty, lastTradedPrice);

            baseToken.transfer(buyOrder.owner, uint256(decryptedTradeQty) * 1e18);
            quoteToken.transfer(sellOrder.owner, quoteAmount);

            emit TradeSettled(
                settlementId,
                settlement.buyOrderId,
                settlement.sellOrderId,
                decryptedTradeQty,
                quoteAmount
            );

            // Auto-mark fully-filled orders so traders don't need to call markFilled manually.
            if (buyOrder.status == OrderStatus.OPEN && buyOrder.remainingAmount == 0) {
                buyOrder.status = OrderStatus.FILLED;
                _removeFromOpenOrders(buyOrder.id);
                FHE.makePubliclyDecryptable(buyOrder.encryptedPrice);
                emit OrderFilled(buyOrder.id);
            }
            if (sellOrder.status == OrderStatus.OPEN && sellOrder.remainingAmount == 0) {
                sellOrder.status = OrderStatus.FILLED;
                _removeFromOpenOrders(sellOrder.id);
                FHE.makePubliclyDecryptable(sellOrder.encryptedPrice);
                emit OrderFilled(sellOrder.id);
            }
        } else {
            buyOrder.remainingAmount  += settlement.tradeQty;
            sellOrder.remainingAmount += settlement.tradeQty;
            emit NoMatch(settlementId, settlement.buyOrderId, settlement.sellOrderId);
        }
    }

    function markFilled(uint256 orderId) external {
        Order storage order = _orders[orderId];
        require(order.owner == msg.sender, "CipherBook: not your order");
        require(order.status == OrderStatus.OPEN, "CipherBook: order not open");
        require(order.remainingAmount == 0, "CipherBook: order not fully matched");

        FHE.makePubliclyDecryptable(order.encryptedPrice);
        order.status = OrderStatus.FILLED;
        _removeFromOpenOrders(orderId);
        emit OrderFilled(orderId);
    }

    function withdrawUnusedEscrow(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];
        require(order.owner == msg.sender, "CipherBook: not your order");
        require(
            order.status == OrderStatus.FILLED || order.status == OrderStatus.CANCELLED,
            "CipherBook: order must be filled or cancelled first"
        );

        uint256 toReturn = order.escrowedTokens;
        require(toReturn > 0, "CipherBook: no escrow to withdraw");

        order.escrowedTokens = 0;

        if (order.side == OrderSide.SELL) {
            baseToken.transfer(order.owner, toReturn);
        } else {
            quoteToken.transfer(order.owner, toReturn);
        }
        emit EscrowReturned(orderId, order.owner, toReturn);
    }

    function getMyOrder(uint256 orderId) external view returns (Order memory) {
        require(_orders[orderId].owner == msg.sender, "CipherBook: not your order");
        return _orders[orderId];
    }

    function getMyOrderIds() external view returns (uint256[] memory) {
        return _userOrderIds[msg.sender];
    }

    function getPendingSettlement(uint256 settlementId) external view returns (PendingSettlement memory) {
        return _pendingSettlements[settlementId];
    }

    function getPendingSettlementIds() external view returns (uint256[] memory) {
        return _pendingSettlementIds;
    }

    function getOpenOrderCount() external view returns (uint256) {
        return _openOrderIds.length;
    }

    function getMarketSummary()
        external
        view
        returns (uint256 _lastTradedPrice, uint256 _totalVolume, uint256 _totalTrades, uint256 _openOrders)
    {
        return (lastTradedPrice, totalVolumeTraded, totalTradesExecuted, _openOrderIds.length);
    }

    function getRecentTrades() external view returns (TradeRecord[] memory) {
        uint8 count = _tradeRingCount;
        TradeRecord[] memory result = new TradeRecord[](count);
        uint8 startIdx = (count < uint8(MAX_RECENT_TRADES)) ? 0 : _tradeRingNext;
        for (uint8 i = 0; i < count; i++) {
            result[i] = _tradeRing[(startIdx + i) % uint8(MAX_RECENT_TRADES)];
        }
        return result;
    }

    function _recordTrade(uint64 qty, uint256 price) internal {
        _tradeRing[_tradeRingNext] = TradeRecord({qty: qty, price: price, timestamp: block.timestamp});
        _tradeRingNext = uint8((_tradeRingNext + 1) % MAX_RECENT_TRADES);
        if (_tradeRingCount < uint8(MAX_RECENT_TRADES)) _tradeRingCount++;
    }

    function _removeFromOpenOrders(uint256 orderId) internal {
        uint256 len = _openOrderIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (_openOrderIds[i] == orderId) {
                _openOrderIds[i] = _openOrderIds[len - 1];
                _openOrderIds.pop();
                return;
            }
        }
    }

    function _removeFromPendingSettlements(uint256 settlementId) internal {
        uint256 len = _pendingSettlementIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (_pendingSettlementIds[i] == settlementId) {
                _pendingSettlementIds[i] = _pendingSettlementIds[len - 1];
                _pendingSettlementIds.pop();
                return;
            }
        }
    }
}
