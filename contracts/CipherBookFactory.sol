// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {CipherBook} from "./CipherBook.sol";

/// @title CipherBookFactory
/// @notice Deploys and tracks CipherBook instances for any ERC-20 token pair.
///         Each pair is a fully independent encrypted order book.
contract CipherBookFactory {
    /// @notice baseToken => quoteToken => CipherBook address (0 if not created)
    mapping(address => mapping(address => address)) public getPair;

    /// @notice All deployed CipherBook addresses in creation order
    address[] public allPairs;

    event PairCreated(
        address indexed baseToken,
        address indexed quoteToken,
        address pair,
        uint256 pairIndex
    );

    /// @notice Deploy a new CipherBook for a token pair.
    ///         Reverts if the pair (in either direction) already exists.
    function createPair(address baseToken, address quoteToken) external returns (address pair) {
        require(baseToken != quoteToken, "CipherBookFactory: identical tokens");
        require(baseToken  != address(0), "CipherBookFactory: zero base token");
        require(quoteToken != address(0), "CipherBookFactory: zero quote token");
        require(
            getPair[baseToken][quoteToken] == address(0),
            "CipherBookFactory: pair already exists"
        );

        CipherBook book = new CipherBook(baseToken, quoteToken);
        pair = address(book);

        getPair[baseToken][quoteToken] = pair;
        // Index reverse direction so callers can find the pair regardless of argument order.
        getPair[quoteToken][baseToken] = pair;

        allPairs.push(pair);
        emit PairCreated(baseToken, quoteToken, pair, allPairs.length - 1);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}
