import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { MuonDVNV2 } from "../typechain-types";
import {
  MockContract,
  deployMockContract,
} from "@ethereum-waffle/mock-contract";
import IMuonClient from "../artifacts/contracts/interfaces/IMuonClient.sol/IMuonClient.json";
import ILayerZeroEndpointV2 from "../artifacts/contracts/interfaces/ILayerZeroEndpointV2.sol/ILayerZeroEndpointV2.json";
import ILayerZeroEndpointV1 from "../artifacts/contracts/interfaces/ILayerZeroEndpoint.sol/ILayerZeroEndpoint.json";
import ILayerZeroDvn from "../artifacts/contracts/interfaces/ILayerZeroDVN.sol/ILayerZeroDVN.json";
import IDvnFeeLib from "../artifacts/contracts/interfaces/IDVNFeeLib.sol/IDVNFeeLib.json";
import IWorker from "../artifacts/contracts/interfaces/IWorker.sol/IWorker.json";
import ISendLid from "../artifacts/contracts/interfaces/ISendLib.sol/ISendLib.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

describe("MuonDVN", () => {
  let muonDVN: MuonDVNV2;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let dvnConfig: SignerWithAddress;
  let dvnConfig1: SignerWithAddress;
  let muonMock: MockContract;
  let testMock: MockContract;
  let lzEndpointV1Mock: MockContract;
  let layerZeroEndpointV2: MockContract;
  let layerZeroDvn: MockContract;
  let feeLibMock: MockContract;
  let priceFeedMock: MockContract;
  let sendLibMock: MockContract;

  const publicKey = {
    x: "0x00",
    parity: 1,
  };

  const zeroAddress = ethers.constants.AddressZero;
  beforeEach(async () => {
    [owner, addr1, addr2, dvnConfig, dvnConfig1] = await ethers.getSigners();

    muonMock = await deployMockContract(owner, IMuonClient.abi);
    testMock = await deployMockContract(owner, IMuonClient.abi);

    sendLibMock = await deployMockContract(owner, ISendLid.abi);

    lzEndpointV1Mock = await deployMockContract(
      owner,
      ILayerZeroEndpointV1.abi
    );

    layerZeroEndpointV2 = await deployMockContract(
      owner,
      ILayerZeroEndpointV2.abi
    );

    layerZeroDvn = await deployMockContract(owner, ILayerZeroDvn.abi);

    feeLibMock = await deployMockContract(owner, IDvnFeeLib.abi);

    priceFeedMock = await deployMockContract(owner, IWorker.abi);

    await layerZeroEndpointV2.mock.eid.returns(30106);

    const MuonDVN = await ethers.getContractFactory("MuonDVNV2");

    muonDVN = await MuonDVN.deploy(
      "0x0",
      publicKey,
      muonMock.address,
      layerZeroEndpointV2.address,
      lzEndpointV1Mock.address,
      dvnConfig.address,
      100,
      100,
      priceFeedMock.address,
      feeLibMock.address
    );
  });

  it("should allow admin to set MuonAppId", async () => {
    expect(await muonDVN.muonAppId()).to.equal("0x0");
    const newMuonAppId = "0x000";
    await muonDVN.connect(owner).setMuonAppId(newMuonAppId);
    expect(await muonDVN.muonAppId()).to.equal(newMuonAppId);

    await expect(
      muonDVN.connect(addr1).setMuonAppId(newMuonAppId)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
    expect(await muonDVN.muonAppId()).to.equal(newMuonAppId);
  });

  it("should allow admin to set muon contract", async () => {
    expect(await muonDVN.muon()).to.be.equals(muonMock.address);
    await expect(
      muonDVN.connect(addr1).setMuonContract(muonMock.address)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
    await muonDVN.connect(owner).setMuonContract(testMock.address);
    expect(await muonDVN.muon()).to.be.equals(testMock.address);
  });

  it("should allow admin to setMuonPubKey", async () => {
    await expect(
      muonDVN.connect(addr1).setMuonPubKey(publicKey)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );

    let checkPublicKey = await muonDVN.muonPublicKey();
    expect(checkPublicKey.x).to.equal(BigNumber.from("0x00"));
    expect(checkPublicKey.parity).to.equal(1);

    const newPublicKey = {
      x: "0x000",
      parity: 5,
    };

    await muonDVN.connect(owner).setMuonPubKey(newPublicKey);
    checkPublicKey = await muonDVN.muonPublicKey();

    expect(checkPublicKey.x).to.equal(BigNumber.from("0x000"));
    expect(checkPublicKey.parity).to.equal(5);
  });

  it("should allow admin to update setDVNConfig", async () => {
    expect(await muonDVN.dvnConfig()).to.equal(dvnConfig.address);

    await expect(
      muonDVN.connect(addr1).setDVNConfig(dvnConfig1.address)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );

    await muonDVN.connect(owner).setDVNConfig(dvnConfig1.address);
    expect(await muonDVN.dvnConfig()).to.equal(dvnConfig1.address);
  });

  it("should allow admin to setLzEndpointV2", async () => {
    expect(await muonDVN.layerZeroEndpointV2()).to.equal(
      layerZeroEndpointV2.address
    );

    await expect(
      muonDVN.connect(addr1).setLzEndpointV2(testMock.address)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );

    await muonDVN.connect(owner).setLzEndpointV2(testMock.address);
    expect(await muonDVN.layerZeroEndpointV2()).to.equal(testMock.address);
  });

  it("should allow admin to setLzEndpointV1", async () => {
    expect(await muonDVN.layerZeroEndpointV1()).to.equal(
      lzEndpointV1Mock.address
    );

    await expect(
      muonDVN.connect(addr1).setLzEndpointV1(testMock.address)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );

    await muonDVN.connect(owner).setLzEndpointV1(testMock.address);
    expect(await muonDVN.layerZeroEndpointV1()).to.equal(testMock.address);
  });

  it("should allow admin to update supported dst chain", async () => {
    const dstEid = 2;
    await muonDVN.connect(owner).updateSupportedDstChain(dstEid, true);
    expect(await muonDVN.supportedDstChain(dstEid)).to.equal(true);

    await expect(
      muonDVN.connect(addr1).updateSupportedDstChain(dstEid, true)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should allow admin to setPriceFeed", async () => {
    expect(await muonDVN.priceFeed()).to.equal(priceFeedMock.address);

    await expect(
      muonDVN.connect(addr1).setPriceFeed(testMock.address)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
    expect(await muonDVN.priceFeed()).to.equal(priceFeedMock.address);

    await muonDVN.connect(owner).setPriceFeed(testMock.address);
    expect(await muonDVN.priceFeed()).to.equal(testMock.address);
  });

  it("should allow admin to setDefaultMultiplierBps", async () => {
    expect(await muonDVN.defaultMultiplierBps()).to.equal(100);

    await expect(
      muonDVN.connect(addr1).setDefaultMultiplierBps(200)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );

    await muonDVN.connect(owner).setDefaultMultiplierBps(300);
    expect(await muonDVN.defaultMultiplierBps()).to.equal(300);
  });

  it("should allow admin to setDstConfig", async () => {
    const dstConfigParams = [
      {
        dstEid: 1,
        gas: 100000,
        multiplierBps: 5000,
        floorMarginUSD: ethers.BigNumber.from("1000000000000000000"),
      },
      {
        dstEid: 2,
        gas: 200000,
        multiplierBps: 6000,
        floorMarginUSD: ethers.BigNumber.from("2000000000000000000"),
      },
    ];

    await expect(
      muonDVN.connect(addr1).setDstConfig(dstConfigParams)
    ).revertedWithCustomError(muonDVN, "AccessControlUnauthorizedAccount");

    await muonDVN.connect(owner).setDstConfig(dstConfigParams);
    for (const param of dstConfigParams) {
      const config = await muonDVN.dstConfig(param.dstEid);
      expect(config.gas).to.equal(param.gas);
      expect(config.multiplierBps).to.equal(param.multiplierBps);
      expect(config.floorMarginUSD).to.equal(param.floorMarginUSD);
    }
  });

  it("should allow admin to setFeeLib", async () => {
    expect(await muonDVN.feeLib()).to.equal(feeLibMock.address);
    await expect(
      muonDVN.connect(addr1).setFeeLib(testMock.address)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
    await muonDVN.connect(owner).setFeeLib(testMock.address);
    expect(await muonDVN.feeLib()).to.equal(testMock.address);
  });

  it("should allow admin to withdrawFee", async () => {
    const amount = ethers.utils.parseEther("1");

    await muonDVN.grantRole(await muonDVN.MESSAGE_LIB_ROLE(), owner.address);
    await muonDVN.grantRole(
      await muonDVN.MESSAGE_LIB_ROLE(),
      sendLibMock.address
    );

    await sendLibMock.mock.withdrawFee
      .withArgs(addr1.address, amount)
      .returns();

    await expect(
      muonDVN
        .connect(owner)
        .withdrawFee(sendLibMock.address, addr1.address, amount)
    )
      .to.emit(muonDVN, "Withdraw")
      .withArgs(sendLibMock.address, addr1.address, amount);

    await expect(
      muonDVN
        .connect(addr1)
        .withdrawFee(feeLibMock.address, addr2.address, amount)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should revert if non-admin tries to withdrawFee", async () => {
    const amount = ethers.utils.parseEther("1");
    await expect(
      muonDVN
        .connect(addr1)
        .withdrawFee(feeLibMock.address, addr2.address, amount)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should revert if the _lib doesn't have MESSAGE_LIB_ROLE", async () => {
    const amount = ethers.utils.parseEther("1");
    await expect(
      muonDVN
        .connect(owner)
        .withdrawFee(feeLibMock.address, addr2.address, amount)
    ).to.be.revertedWithCustomError(muonDVN, "Worker_OnlyMessageLib");
  });

  it("should assign job and calculate fee correctly", async () => {
    const dstEid = 30106;
    const payloadHash = ethers.utils.keccak256("0x5678");
    const confirmations = 1;
    const sender = owner.address;
    const options = "0x";

    const mockPacket = {
      nonce: 1,
      srcEid: 1,
      sender: owner.address,
      dstEid,
      receiver: addr2.address,
    };

    const packetHeader = ethers.utils.solidityPack(
      ["uint8", "uint256", "uint32", "address", "uint32", "address"],
      [
        1,
        mockPacket.nonce,
        mockPacket.srcEid,
        mockPacket.sender,
        mockPacket.dstEid,
        mockPacket.receiver,
      ]
    );

    const feeAmount = 1000;
    await feeLibMock.mock.getFeeOnSend.returns(
      ethers.BigNumber.from(feeAmount)
    );

    await feeLibMock.mock.getFee.returns(feeAmount);

    await expect(
      muonDVN.connect(addr1).assignJob(
        {
          dstEid,
          packetHeader,
          payloadHash,
          confirmations,
          sender,
        },
        options
      )
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );

    await muonDVN
      .connect(owner)
      .grantRole(await muonDVN.MESSAGE_LIB_ROLE(), addr1.address);

    await expect(
      muonDVN.connect(addr1).assignJob(
        {
          dstEid,
          packetHeader,
          payloadHash,
          confirmations,
          sender,
        },
        options
      )
    ).to.be.rejectedWith("Unsupported chain");

    await muonDVN.connect(owner).updateSupportedDstChain(dstEid, true);

    await muonDVN.connect(owner).setFeeLib(feeLibMock.address);

    const tx = await muonDVN.connect(addr1).assignJob(
      {
        dstEid,
        packetHeader,
        payloadHash,
        confirmations,
        sender,
      },
      options
    );

    const receipt = await tx.wait();
    expect(receipt.events[0].event).to.equal("JobAssigned");

    const job = await muonDVN.jobs(1);
    expect(job.origin).to.equal(addr1.address);
    expect(job.srcEid).to.equal(dstEid);
    expect(job.dstEid).to.equal(mockPacket.dstEid);
    expect(job.sender).to.equal(mockPacket.sender);
    expect(job.receiver).to.equal(mockPacket.receiver);
    expect(job.options).to.equal(options);
    expect(
      await muonDVN.getFee(dstEid, confirmations, sender, options)
    ).to.be.equals(feeAmount);
  });
});
