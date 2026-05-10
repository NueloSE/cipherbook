// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice A simple ERC-20 token for CipherBook testnet use.
///         Anyone can call faucet() to mint tokens — no access control by design.
contract MockERC20 is ERC20 {
    uint8 private immutable _decimals;

    // Max tokens mintable per faucet call — prevents a single address from draining the faucet
    uint256 public constant FAUCET_LIMIT = 1_000_000 * 1e18;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint tokens to any address. Intended for testnet only.
    /// @param to      Recipient address
    /// @param amount  Amount to mint (in token's smallest unit)
    function faucet(address to, uint256 amount) external {
        require(amount <= FAUCET_LIMIT, "MockERC20: exceeds faucet limit");
        _mint(to, amount);
    }
}
