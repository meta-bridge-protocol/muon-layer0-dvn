// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ILayerZeroEndpointV2} from "./interfaces/ILayerZeroEndpointV2.sol";
import {ILayerZeroDVN} from "./interfaces/ILayerZeroDVN.sol";
import {IReceiveUlnE2, Verification, UlnConfig} from "./interfaces/IReceiveUlnE2.sol";
import "./interfaces/IMuonClient.sol";

contract MuonDVN is ILayerZeroDVN, AccessControl {
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
        bytes options;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    ILayerZeroEndpointV2 public layerZeroEndpointV2;
    address public sendLib302;
    IReceiveUlnE2 public receiveLib302;

    uint256 public lastJobId;

    uint256 public muonAppId;
    IMuonClient.PublicKey public muonPublicKey;
    IMuonClient public muon;
    address public muonValidGateway;

    uint256 public fee = 0.001 ether;

    mapping(uint256 => Job) public jobs;

    // eid => bool
    mapping(uint32 => bool) public supportedDstChain;
    // srcEid => ( jobId => isVerified )
    mapping(uint32 => mapping(uint256 => bool)) public verifiedJobs;

    event JobAssigned(uint256 jobId);

    constructor(
        uint256 _muonAppId,
        IMuonClient.PublicKey memory _muonPublicKey,
        address _muon,
        address _layerZeroEndpointV2,
        address _sendLib302,
        address _receiveLib302
    ) {
        muonAppId = _muonAppId;
        muonPublicKey = _muonPublicKey;
        muon = IMuonClient(_muon);
        layerZeroEndpointV2 = ILayerZeroEndpointV2(_layerZeroEndpointV2);
        sendLib302 = _sendLib302;
        receiveLib302 = IReceiveUlnE2(_receiveLib302);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function assignJob(
        AssignJobParam calldata _param,
        bytes calldata _options
    ) external payable override returns (uint256 _fee) {
        require(supportedDstChain[_param.dstEid], "Unsupported chain");

        require(msg.sender == sendLib302, "Invalid sender");

        uint256 jobId = ++lastJobId;
        Job storage newJob = jobs[jobId];

        newJob.origin = msg.sender;
        newJob.srcEid = layerZeroEndpointV2.eid();
        newJob.dstEid = _param.dstEid;
        newJob.packetHeader = _param.packetHeader;
        newJob.payloadHash = _param.payloadHash;
        newJob.confirmations = _param.confirmations;
        newJob.sender = _param.sender;
        newJob.options = _options;

        emit JobAssigned(jobId);

        _fee = fee;
    }

    function getFee(
        uint32 _dstEid,
        uint64 _confirmations,
        address _sender,
        bytes calldata _options
    ) external view override returns (uint256 _fee) {
        _fee = fee;
    }

    function verify(
        uint32 _srcEid,
        uint32 _dstEid,
        uint256 _jobId,
        bytes memory _packetHeader,
        bytes32 _payloadHash,
        uint64 _confirmations,
        bytes calldata _reqId,
        IMuonClient.SchnorrSign calldata _signature,
        bytes calldata gatewaySignature
    ) external {
        require(_dstEid == layerZeroEndpointV2.eid(), "Invalid dstEid");
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
                _confirmations
            )
        );

        _verifyMuonSig(_reqId, hash, _signature, gatewaySignature);

        receiveLib302.verify(_packetHeader, _payloadHash, _confirmations);
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

    function setMuonGateway(
        address _gatewayAddress
    ) external onlyRole(ADMIN_ROLE) {
        muonValidGateway = _gatewayAddress;
    }

    function setLzEndpointV2(
        address _layerZeroEndpointV2
    ) external onlyRole(ADMIN_ROLE) {
        layerZeroEndpointV2 = ILayerZeroEndpointV2(_layerZeroEndpointV2);
    }

    function setSendLib302(address _sendLib302) external onlyRole(ADMIN_ROLE) {
        sendLib302 = _sendLib302;
    }

    function setReceiveLib302(
        address _receiveLib302
    ) external onlyRole(ADMIN_ROLE) {
        receiveLib302 = IReceiveUlnE2(_receiveLib302);
    }

    function updateSupportedDstChain(
        uint32 eid,
        bool status
    ) external onlyRole(ADMIN_ROLE) {
        supportedDstChain[eid] = status;
    }

    function _verifyMuonSig(
        bytes calldata reqId,
        bytes32 hash,
        IMuonClient.SchnorrSign calldata sign,
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
}
