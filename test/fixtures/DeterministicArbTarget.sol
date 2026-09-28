// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Test-only deterministic settlement target. It does not pretend to be a DEX.
/// It models an A -> B -> A route by consuming token A and returning token A plus
/// a deterministic premium from liquidity pre-funded by the fork test.
contract DeterministicArbTarget {
    using SafeERC20 for IERC20;

    address public immutable owner;

    error OnlyExecutor();
    error InsufficientLiquidity();
    error InvalidAmount();
    error InvalidToken();

    constructor() {
        owner = msg.sender;
    }

    function executeArbitrage(
        address token,
        uint256 amount,
        uint256 profitBps
    ) external returns (uint256 returnedAmount) {
        if (amount == 0 || token == address(0)) revert InvalidAmount();
        if (profitBps == 0 || profitBps > 10_000) revert InvalidAmount();

        uint256 premium = (amount * profitBps) / 10_000;
        returnedAmount = amount + premium;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        if (IERC20(token).balanceOf(address(this)) < returnedAmount) {
            revert InsufficientLiquidity();
        }

        IERC20(token).safeTransfer(msg.sender, returnedAmount);
    }

    function fund(address token, uint256 amount) external {
        if (msg.sender != owner) revert OnlyExecutor();
        if (token == address(0) || amount == 0) revert InvalidAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(
        address token,
        address to,
        uint256 amount
    ) external {
        if (msg.sender != owner) revert OnlyExecutor();
        if (token == address(0) || to == address(0)) revert InvalidToken();
        IERC20(token).safeTransfer(to, amount);
    }
}
