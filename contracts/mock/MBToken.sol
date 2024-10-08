// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {OFTMsgCodec} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTMsgCodec.sol";
import {OFTComposeMsgCodec} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTComposeMsgCodec.sol";
import {IGateway} from "../interfaces/IGateway.sol";

contract MBToken is ERC20Burnable, OFT, AccessControl {
    using OFTMsgCodec for bytes;
    using OFTMsgCodec for bytes32;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    IGateway public gateway;

    constructor(
        string memory _name,
        string memory _symbol,
        address _layerZeroEndpoint, // local endpoint address
        address _owner // token owner used as a delegate in LayerZero Endpoint
    ) OFT(_name, _symbol, _layerZeroEndpoint, _owner) Ownable(_owner) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(address _to, uint256 _amount) external onlyRole(MINTER_ROLE) {
        require(address(gateway) != address(0), "Gateway is not set");
        _mint(_to, _amount);
    }

    function setGateway(address _gateway) external onlyOwner {
        require(_gateway != address(0), "Zero address");
        gateway = IGateway(_gateway);
    }

    /**
     * @dev Internal function to handle the receive on the LayerZero endpoint.
     * @param _origin The origin information.
     *  - srcEid: The source chain endpoint ID.
     *  - sender: The sender address from the src chain.
     *  - nonce: The nonce of the LayerZero message.
     * @param _guid The unique identifier for the received LayerZero message.
     * @param _message The encoded message.
     * @dev _executor The address of the executor.
     * @dev _extraData Additional data.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /*_executor*/, // @dev unused in the default implementation.
        bytes calldata /*_extraData*/ // @dev unused in the default implementation.
    ) internal virtual override {
        // @dev The src sending chain doesnt know the address length on this chain (potentially non-evm)
        // Thus everything is bytes32() encoded in flight.
        address toAddress = _message.sendTo().bytes32ToAddress();

        uint256 balance = IERC20(gateway.nativeToken()).balanceOf(
            address(gateway)
        );

        // @dev Credit the amountLD to the recipient and return the ACTUAL amount the recipient received in local decimals
        uint256 amountReceivedLD = _credit(
            address(this),
            _toLD(_message.amountSD()),
            _origin.srcEid
        );

        if (balance >= amountReceivedLD) {
            _approve(address(this), address(gateway), amountReceivedLD);
            gateway.swapToNativeTo(amountReceivedLD, toAddress);
        } else {
            if (balance > 0) {
                _approve(address(this), address(gateway), balance);
                gateway.swapToNativeTo(balance, toAddress);
            }
            _transfer(address(this), toAddress, amountReceivedLD - balance);
        }

        if (_message.isComposed()) {
            // @dev Proprietary composeMsg format for the OFT.
            bytes memory composeMsg = OFTComposeMsgCodec.encode(
                _origin.nonce,
                _origin.srcEid,
                amountReceivedLD,
                _message.composeMsg()
            );

            // @dev Stores the lzCompose payload that will be executed in a separate tx.
            // Standardizes functionality for executing arbitrary contract invocation on some non-evm chains.
            // @dev The off-chain executor will listen and process the msg based on the src-chain-callers compose options passed.
            // @dev The index is used when a OApp needs to compose multiple msgs on lzReceive.
            // For default OFT implementation there is only 1 compose msg per lzReceive, thus its always 0.
            endpoint.sendCompose(
                toAddress,
                _guid,
                0 /* the index of the composed message*/,
                composeMsg
            );
        }

        emit OFTReceived(_guid, _origin.srcEid, toAddress, amountReceivedLD);
    }
}
