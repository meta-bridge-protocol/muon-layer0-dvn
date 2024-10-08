// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IGateway {
    /// @notice Swaps a specified amount of mb tokens to native tokens.
	/// @param amount The amount of mb tokens to swap.
	/// @param to The recipient address of the native tokens.
    function swapToNativeTo(uint256 amount, address to) external;

    function nativeToken() external view returns (address);
}
