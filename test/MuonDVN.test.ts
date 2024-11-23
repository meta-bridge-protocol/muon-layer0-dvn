import { expect } from "chai";
import { ethers } from "hardhat";
import { MuonDVN } from "../typechain-types";
import {
  MockContract,
  deployMockContract,
} from "@ethereum-waffle/mock-contract";
import IMuonClient from "../artifacts/contracts/interfaces/IMuonClient.sol/IMuonClient.json";
import ILayerZeroEndpointV2 from "../artifacts/contracts/interfaces/ILayerZeroEndpointV2.sol/ILayerZeroEndpointV2.json";
import ILayerZeroEndpointV1 from "../artifacts/contracts/interfaces/ILayerZeroEndpoint.sol/ILayerZeroEndpoint.json";
import ILayerZeroDvn from "../artifacts/contracts/interfaces/ILayerZeroDVN.sol/ILayerZeroDVN.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("MuonDVN", () => {
  let muonDVN: MuonDVN;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let dvnConfig: SignerWithAddress;
  let muonMock: MockContract;
  let lzEndpointV1Mock: MockContract;
  let layerZeroEndpointV2: MockContract;
  let layerZeroDvn: MockContract;

  const zeroAddress = ethers.constants.AddressZero;
  beforeEach(async () => {
    [owner, addr1, addr2, dvnConfig] = await ethers.getSigners();

    muonMock = await deployMockContract(owner, IMuonClient.abi);

    lzEndpointV1Mock = await deployMockContract(
      owner,
      ILayerZeroEndpointV1.abi
    );

    layerZeroEndpointV2 = await deployMockContract(
      owner,
      ILayerZeroEndpointV2.abi
    );

    layerZeroDvn = await deployMockContract(owner, ILayerZeroDvn.abi);

    await layerZeroEndpointV2.mock.eid.returns(30106);

    const publicKey = {
      x: 1234,
      parity: 1,
    };

    const MuonDVN = await ethers.getContractFactory("MuonDVN");

    muonDVN = await MuonDVN.deploy(
      "0x0",
      publicKey,
      muonMock.address,
      layerZeroEndpointV2.address,
      lzEndpointV1Mock.address,
      dvnConfig.address
    );
  });

  it("should assign a new job", async () => {
    const dstEid = 30106;

    const payloadHash = ethers.utils.keccak256("0x5678");
    const confirmations = 1;
    const sender = owner.address;
    const options = "0x";

    const MESSAGE_LIB_ROLE = await muonDVN.MESSAGE_LIB_ROLE();
    await muonDVN.connect(owner).grantRole(MESSAGE_LIB_ROLE, addr1.address);

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

    expect((await muonDVN.jobs(1)).sender).to.be.equal(zeroAddress);
    expect((await muonDVN.jobs(1)).receiver).to.be.equal(zeroAddress);

    await expect(
      muonDVN.connect(addr1).assignJob(
        {
          dstEid,
          packetHeader,
          payloadHash,
          confirmations,
          sender,
        },
        options,
        { value: ethers.utils.parseEther("0.01") }
      )
    ).to.be.revertedWith("Unsupported chain");

    expect(await muonDVN.supportedDstChain(dstEid)).to.be.equal(false);

    await muonDVN.connect(owner).updateSupportedDstChain(dstEid, true);
    expect(await muonDVN.supportedDstChain(dstEid)).to.be.equal(true);

    const tx = await muonDVN.connect(addr1).assignJob(
      {
        dstEid,
        packetHeader,
        payloadHash,
        confirmations,
        sender,
      },
      options,
      { value: ethers.utils.parseEther("0.01") }
    );

    const receipt = await tx.wait();
    expect(receipt.events[0].event).to.equal("JobAssigned");

    expect((await muonDVN.jobs(1)).sender).to.be.equal(owner.address);
    expect((await muonDVN.jobs(1)).receiver).to.be.equal(mockPacket.receiver);
  });

  it("should allow owner to set fee", async () => {
    const newFee = ethers.utils.parseEther("0.01");
    await muonDVN.connect(owner).setFee(newFee);
    expect(await muonDVN.fee()).to.equal(newFee);
    await expect(
      muonDVN.connect(addr1).setFee(newFee)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
  });

  it("should allow admin to set MuonAppId", async () => {
    const newMuonAppId = 12345;
    await muonDVN.connect(owner).setMuonAppId(newMuonAppId);
    expect(await muonDVN.muonAppId()).to.equal(newMuonAppId);

    await expect(
      muonDVN.connect(addr1).setMuonAppId(newMuonAppId)
    ).to.be.revertedWithCustomError(
      muonDVN,
      "AccessControlUnauthorizedAccount"
    );
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
});
