// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ILayerZeroEndpointV2} from "./interfaces/ILayerZeroEndpointV2.sol";
import {ILayerZeroEndpoint} from "./interfaces/ILayerZeroEndpoint.sol";
import {ILayerZeroDVN} from "./interfaces/ILayerZeroDVN.sol";
import {IReceiveUlnE2, Verification, UlnConfig} from "./interfaces/IReceiveUlnE2.sol";
import {ISendLib} from "./interfaces/ISendLib.sol";
import {IDVNFeeLib} from "./interfaces/IDVNFeeLib.sol";
import {IMuonDVNConfig} from "./interfaces/IMuonDVNConfig.sol";
import {IDVN} from "./interfaces/IDVN.sol";
import "./interfaces/IMuonClient.sol";
import "./utils/PacketV1Codec.sol";

contract MuonDVNV2 is ILayerZeroDVN, AccessControl, IDVN {
    using PacketV1Codec for bytes;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct Job {
        address origin;
        uint32 srcEid;
        uint32 dstEid;
        bytes packetHeader;
        bytes32 payloadHash;
        uint64 confirmations;
        address sender;
        address receiver;
        bytes options;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MESSAGE_LIB_ROLE = keccak256("MESSAGE_LIB_ROLE");

    ILayerZeroEndpointV2 public layerZeroEndpointV2;
    ILayerZeroEndpoint public layerZeroEndpointV1;
    uint32 public immutable localEid;

    uint256 public lastJobId;

    uint256 public muonAppId;
    IMuonClient.PublicKey public muonPublicKey;
    IMuonClient public muon;
    IMuonDVNConfig public dvnConfig;

    uint16 public defaultMultiplierBps;
    uint64 public quorum;
    address public priceFeed;
    address public feeLib;

    mapping(uint256 => Job) public jobs;

    // eid => bool
    mapping(uint32 => bool) public supportedDstChain;
    mapping(uint32 dstEid => DstConfig) public dstConfig;
    // srcEid => ( jobId => isVerified )
    mapping(uint32 => mapping(uint256 => bool)) public verifiedJobs;

    event JobAssigned(uint256 jobId);
    event Verified(uint32 srcEid, uint256 jobId);

    constructor(
        uint256 _muonAppId,
        IMuonClient.PublicKey memory _muonPublicKey,
        address _muon,
        address _layerZeroEndpointV2,
        address _layerZeroEndpointV1,
        address _dvnConfig,
        uint16 _defaultMultiplierBps,
        uint64 _quorum,
        address _priceFeed,
        address _feeLib
    ) {
        muonAppId = _muonAppId;
        muonPublicKey = _muonPublicKey;
        muon = IMuonClient(_muon);
        layerZeroEndpointV2 = ILayerZeroEndpointV2(_layerZeroEndpointV2);
        layerZeroEndpointV1 = ILayerZeroEndpoint(_layerZeroEndpointV1);
        dvnConfig = IMuonDVNConfig(_dvnConfig);
        localEid = layerZeroEndpointV2.eid();
        defaultMultiplierBps = _defaultMultiplierBps;
        quorum = _quorum;
        priceFeed = _priceFeed;
        feeLib = _feeLib;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function assignJob(
        AssignJobParam calldata _param,
        bytes calldata _options
    )
        external
        payable
        override
        onlyRole(MESSAGE_LIB_ROLE)
        returns (uint256 fee)
    {
        require(supportedDstChain[_param.dstEid], "Unsupported chain");

        uint256 jobId = ++lastJobId;
        Job storage newJob = jobs[jobId];

        newJob.origin = msg.sender;
        newJob.srcEid = localEid;
        newJob.dstEid = _param.dstEid;
        newJob.packetHeader = _param.packetHeader;
        newJob.payloadHash = _param.payloadHash;
        newJob.confirmations = _param.confirmations;
        newJob.sender = _param.sender;
        newJob.receiver = address(
            uint160(uint256(_param.packetHeader.receiver()))
        );
        newJob.options = _options;

        IDVNFeeLib.FeeParams memory feeParams = IDVNFeeLib.FeeParams(
            priceFeed,
            _param.dstEid,
            _param.confirmations,
            _param.sender,
            quorum,
            defaultMultiplierBps
        );

        fee = IDVNFeeLib(feeLib).getFeeOnSend(
            feeParams,
            dstConfig[_param.dstEid],
            _options
        );

        emit JobAssigned(jobId);
    }

    function verify(
        uint32 _srcEid,
        uint32 _dstEid,
        uint256 _jobId,
        bytes memory _packetHeader,
        bytes32 _payloadHash,
        uint64 _confirmations,
        address _receiver,
        bytes calldata _reqId,
        IMuonClient.SchnorrSign calldata _signature,
        bytes calldata gatewaySignature
    ) external {
        require(_isLocal(_dstEid), "Invalid dstEid");
        require(
            !verifiedJobs[_srcEid][_jobId],
            "src jobId is already verified"
        );

        verifiedJobs[_srcEid][_jobId] = true;

        bytes32 hash = keccak256(
            abi.encodePacked(
                muonAppId,
                _reqId,
                _srcEid,
                _dstEid,
                _jobId,
                _packetHeader,
                _payloadHash,
                _confirmations,
                _receiver
            )
        );

        _verifyMuonSig(
            _reqId,
            hash,
            _signature,
            dvnConfig.shieldNodes(_receiver),
            gatewaySignature
        );

        _lzVerify(
            _srcEid,
            _packetHeader,
            _payloadHash,
            _confirmations,
            _receiver
        );

        emit Verified(_srcEid, _jobId);
    }

    function setMuonAppId(uint256 _muonAppId) external onlyRole(ADMIN_ROLE) {
        muonAppId = _muonAppId;
    }

    function setMuonContract(address addr) external onlyRole(ADMIN_ROLE) {
        muon = IMuonClient(addr);
    }

    function setMuonPubKey(
        IMuonClient.PublicKey memory _muonPublicKey
    ) external onlyRole(ADMIN_ROLE) {
        muonPublicKey = _muonPublicKey;
    }

    function setDVNConfig(address _dvnConfig) external onlyRole(ADMIN_ROLE) {
        dvnConfig = IMuonDVNConfig(_dvnConfig);
    }

    function setLzEndpointV2(
        address _layerZeroEndpointV2
    ) external onlyRole(ADMIN_ROLE) {
        layerZeroEndpointV2 = ILayerZeroEndpointV2(_layerZeroEndpointV2);
    }

    function setLzEndpointV1(
        address _layerZeroEndpointV1
    ) external onlyRole(ADMIN_ROLE) {
        layerZeroEndpointV1 = ILayerZeroEndpoint(_layerZeroEndpointV1);
    }

    function updateSupportedDstChain(
        uint32 eid,
        bool status
    ) external onlyRole(ADMIN_ROLE) {
        supportedDstChain[eid] = status;
    }

    function setPriceFeed(address _priceFeed) external onlyRole(ADMIN_ROLE) {
        priceFeed = _priceFeed;
    }

    function setDefaultMultiplierBps(
        uint16 _multiplierBps
    ) external onlyRole(ADMIN_ROLE) {
        defaultMultiplierBps = _multiplierBps;
    }

    function setDstConfig(
        DstConfigParam[] calldata _params
    ) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < _params.length; ++i) {
            DstConfigParam calldata param = _params[i];
            dstConfig[param.dstEid] = DstConfig(
                param.gas,
                param.multiplierBps,
                param.floorMarginUSD
            );
        }
        emit SetDstConfig(_params);
    }

    function setFeeLib(address _feeLib) external onlyRole(ADMIN_ROLE) {
        feeLib = _feeLib;
    }

    function withdrawFee(
        address _lib,
        address _to,
        uint256 _amount
    ) external onlyRole(ADMIN_ROLE) {
        if (!hasRole(MESSAGE_LIB_ROLE, _lib)) revert Worker_OnlyMessageLib();
        ISendLib(_lib).withdrawFee(_to, _amount);
        emit Withdraw(_lib, _to, _amount);
    }

    function getFee(
        uint32 _dstEid,
        uint64 _confirmations,
        address _sender,
        bytes calldata _options
    ) external view override returns (uint256 _fee) {
        IDVNFeeLib.FeeParams memory params = IDVNFeeLib.FeeParams(
            priceFeed,
            _dstEid,
            _confirmations,
            _sender,
            quorum,
            defaultMultiplierBps
        );
        return IDVNFeeLib(feeLib).getFee(params, dstConfig[_dstEid], _options);
    }

    function _verifyMuonSig(
        bytes calldata reqId,
        bytes32 hash,
        IMuonClient.SchnorrSign calldata sign,
        address muonValidGateway,
        bytes calldata gatewaySignature
    ) internal {
        bool verified = muon.muonVerify(
            reqId,
            uint256(hash),
            sign,
            muonPublicKey
        );
        require(verified, "Invalid signature!");

        if (muonValidGateway != address(0)) {
            hash = hash.toEthSignedMessageHash();
            address gatewaySignatureSigner = hash.recover(gatewaySignature);

            require(
                gatewaySignatureSigner == muonValidGateway,
                "Gateway is not valid"
            );
        }
    }

    function _lzVerify(
        uint32 _srcEid,
        bytes memory _packetHeader,
        bytes32 _payloadHash,
        uint64 _confirmations,
        address _receiver
    ) internal {
        address receiverLib;
        if (_isV2(_srcEid)) {
            (receiverLib, ) = layerZeroEndpointV2.getReceiveLibrary(
                _receiver,
                _srcEid
            );
        } else {
            receiverLib = layerZeroEndpointV1.getReceiveLibraryAddress(
                _receiver
            );
        }

        IReceiveUlnE2(receiverLib).verify(
            _packetHeader,
            _payloadHash,
            _confirmations
        );
    }

    function _isLocal(uint32 _dstEid) internal view returns (bool) {
        if (localEid == _dstEid || localEid == _dstEid + 30000) {
            return true;
        }
        return false;
    }

    function _isV2(uint32 _eid) internal pure returns (bool) {
        if (_eid > 30000) {
            return true;
        }
        return false;
    }
}
