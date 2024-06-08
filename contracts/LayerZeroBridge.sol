// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MessagingFee, SendParam, IMetaOFT, ILayerZeroEndpointV2} from "./interfaces/IMetaOFT.sol";

/**
 * @title LayerZeroBridge Contract
 * @dev LayerZeroBridge is considered to lock DEUS on src chain then mint and send OFT to the dst chain.
 */
contract LayerZeroBridge is Ownable {
    using SafeERC20 for IERC20;

    ILayerZeroEndpointV2 public lzEndpoint;
    IERC20 public token;
    IMetaOFT public oft;

    event TokenSent(
        uint32 indexed dstEid,
        address indexed from,
        uint256 indexed amount
    );

    event TokenClaimed(uint256 amount);

    constructor(
        address _lzEndpoint,
        address _owner,
        address _token,
        address _oft
    ) Ownable(_owner) {
        token = IERC20(_token);
        oft = IMetaOFT(_oft);
        lzEndpoint = ILayerZeroEndpointV2(_lzEndpoint);
    }

    // Sends a message from the source to destination chain.
    function send(
        uint32 _dstEid,
        uint256 _amount,
        uint256 _minAmountLD,
        bytes calldata _extraOptions,
        MessagingFee calldata _fee
    ) external payable {
        uint256 balance = token.balanceOf(address(this));

        token.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 receivedAmount = token.balanceOf(address(this)) - balance;

        require(
            _amount == receivedAmount,
            "Received amount does not sent amount"
        );

        if (_fee.lzTokenFee > 0) {
            _payLzToken(_fee.lzTokenFee);
        }

        oft.mint(address(this), _amount);

        SendParam memory sendParams = SendParam({
            dstEid: _dstEid, // Destination chain's endpoint ID.
            to: bytes32(uint256(uint160(msg.sender))), // Recipient address.
            amountLD: _amount, // Amount to send in local decimals.
            minAmountLD: _minAmountLD, // Minimum amount to send in local decimals.
            extraOptions: _extraOptions, // Additional options supplied by the caller to be used in the LayerZero message.
            composeMsg: "", // The composed message for the send() operation.
            oftCmd: "" // The OFT command to be executed, unused in default OFT implementations.
        });

        oft.send{value: msg.value}(
            sendParams,
            _fee, // Fee struct containing native gas and ZRO token.
            payable(msg.sender) // The refund address in case the send call reverts.
        );

        emit TokenSent(_dstEid, msg.sender, _amount);
    }

    function claim(uint256 _amount) external {
        oft.burnFrom(msg.sender, _amount);
        token.transfer(msg.sender, _amount);

        emit TokenClaimed(_amount);
    }

    /* @dev Quotes the gas needed to pay for the full omnichain transaction.
     * @return nativeFee Estimated gas fee in native gas.
     * @return lzTokenFee Estimated gas fee in ZRO token.
     */
    function quoteSend(
        address _from,
        uint32 _dstEid,
        uint256 _amount,
        uint256 _minAmountLD,
        bytes calldata _extraOptions,
        bool _payInLzToken
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee) {
        SendParam memory sendParams = SendParam({
            dstEid: _dstEid, // Destination chain's endpoint ID.
            to: bytes32(uint256(uint160(_from))), // Recipient address.
            amountLD: _amount, // Amount to send in local decimals.
            minAmountLD: _minAmountLD, // Minimum amount to send in local decimals.
            extraOptions: _extraOptions, // Additional options supplied by the caller to be used in the LayerZero message.
            composeMsg: "", // The composed message for the send() operation.
            oftCmd: "" // The OFT command to be executed, unused in default OFT implementations.
        });
        MessagingFee memory fee = oft.quoteSend(sendParams, _payInLzToken);
        return (fee.nativeFee, fee.lzTokenFee);
    }

    /**
     * @dev Internal function to pay the LZ token fee associated with the message.
     * @param _lzTokenFee The LZ token fee to be paid.
     *
     * @dev If the caller is trying to pay in the specified lzToken, then the lzTokenFee is passed to the endpoint.
     * @dev Any excess sent, is passed back to the specified _refundAddress in the _lzSend().
     */
    function _payLzToken(uint256 _lzTokenFee) internal virtual {
        address lzToken = lzEndpoint.lzToken();
        require(lzToken != address(0), "lzToken is unavailable");

        // Pay LZ token fee by sending tokens to the endpoint.
        IERC20(lzToken).safeTransferFrom(
            msg.sender,
            address(this),
            _lzTokenFee
        );
        IERC20(lzToken).approve(address(lzEndpoint), _lzTokenFee);
    }
}
