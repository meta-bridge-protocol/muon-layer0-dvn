// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MessagingFee, SendParam, IMetaOFT, ILayerZeroEndpointV2} from "./interfaces/IMetaOFT.sol";

/**
 * @title LayerZeroBridge Contract
 * @dev LayerZeroBridge is considered to lock DEUS on src chain then mint and send OFT to the dst chain.
 */
contract LayerZeroBridge is AccessControl {
    using SafeERC20 for ERC20Burnable;

    struct Token {
        address oft;
        address treasury; // The address of escrow
        address gateway;
        bool isMainChain;
        bool isBurnable;
    }

    ILayerZeroEndpointV2 public lzEndpoint;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TOKEN_ADDER_ROLE = keccak256("TOKEN_ADDER_ROLE");

    // token => Token
    mapping(address => Token) public tokens;

    event TokenSent(
        address indexed token,
        uint32 indexed dstEid,
        address indexed from,
        uint256 amount
    );
    event TokenAdd(address indexed token);
    event TokenRemove(address indexed token);
    event TokenUpdate(address indexed token);

    constructor(address _lzEndpoint) {
        lzEndpoint = ILayerZeroEndpointV2(_lzEndpoint);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // Sends a message from the source to destination chain.
    function send(
        address _token,
        uint32 _dstEid,
        uint256 _amount,
        uint256 _minAmountLD,
        bytes calldata _extraOptions,
        MessagingFee calldata _fee
    ) external payable {
        require(tokens[_token].oft != address(0), "Invalid token");
        ERC20Burnable token = ERC20Burnable(_token);
        IMetaOFT oft = IMetaOFT(tokens[_token].oft);

        if (tokens[_token].isMainChain || !tokens[_token].isBurnable) {
            uint256 balance = token.balanceOf(tokens[_token].treasury);
            token.safeTransferFrom(
                msg.sender,
                tokens[_token].treasury,
                _amount
            );
            uint256 receivedAmount = token.balanceOf(tokens[_token].treasury) -
                balance;
            require(
                _amount == receivedAmount,
                "Received amount does not match sent amount"
            );
        } else {
            token.burnFrom(msg.sender, _amount);
        }

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

        emit TokenSent(_token, _dstEid, msg.sender, _amount);
    }

    function addToken(
        address _token,
        address _oft,
        address _treasury,
        address _gateway,
        bool _isMainChain,
        bool _isBurnable
    ) external onlyRole(TOKEN_ADDER_ROLE) {
        require(_token != address(0), "Invalid token");
        require(_oft != address(0), "Invalid oft");
        require(_gateway != address(0), "Invalid gateway");
        require(tokens[_token].oft == address(0), "Already added");

        Token storage token = tokens[_token];
        token.oft = _oft;
        token.treasury = _treasury;
        token.gateway = _gateway;
        token.isMainChain = _isMainChain;
        token.isBurnable = _isBurnable;
        emit TokenAdd(_token);
    }

    function removeToken(address _token) external onlyRole(TOKEN_ADDER_ROLE) {
        require(tokens[_token].oft != address(0), "Invalid token");

        delete tokens[_token];
        emit TokenRemove(_token);
    }

    function updateToken(
        address _token,
        address _oft,
        address _treasury,
        address _gateway,
        bool _isMainChain,
        bool _isBurnable
    ) external onlyRole(TOKEN_ADDER_ROLE) {
        require(tokens[_token].oft != address(0), "Invalid token");
        require(_token != address(0), "Invalid token");
        require(_oft != address(0), "Invalid oft");
        require(_gateway != address(0), "Invalid gateway");

        Token storage token = tokens[_token];
        token.oft = _oft;
        token.treasury = _treasury;
        token.gateway = _gateway;
        token.isMainChain = _isMainChain;
        token.isBurnable = _isBurnable;
        emit TokenUpdate(_token);
    }

    /* @dev Quotes the gas needed to pay for the full omnichain transaction.
     * @return nativeFee Estimated gas fee in native gas.
     * @return lzTokenFee Estimated gas fee in ZRO token.
     */
    function quoteSend(
        address _token,
        address _from,
        uint32 _dstEid,
        uint256 _amount,
        uint256 _minAmountLD,
        bytes calldata _extraOptions,
        bool _payInLzToken
    ) external view returns (uint256 nativeFee, uint256 lzTokenFee) {
        require(tokens[_token].oft != address(0), "Invalid token");
        IMetaOFT oft = IMetaOFT(tokens[_token].oft);
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
        ERC20Burnable(lzToken).safeTransferFrom(
            msg.sender,
            address(this),
            _lzTokenFee
        );
        ERC20Burnable(lzToken).approve(address(lzEndpoint), _lzTokenFee);
    }
}
