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
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("MuonDVN", () => {
  let muonDVN: MuonDVN;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let dvnConfig: SignerWithAddress;
  let muonMock: MockContract;
  let lzEndpointV1Mock: MockContract;
  let layerZeroEndpointV2: MockContract;

  beforeEach(async () => {
    [owner, addr1, dvnConfig] = await ethers.getSigners();

    muonMock = await deployMockContract(owner, IMuonClient.abi);

    lzEndpointV1Mock = await deployMockContract(
      owner,
      ILayerZeroEndpointV1.abi
    );

    layerZeroEndpointV2 = await deployMockContract(
      owner,
      ILayerZeroEndpointV2.abi
    );

    await layerZeroEndpointV2.mock.eid.returns(1);

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

  it("should allow admin to set fee", async () => {
    const newFee = ethers.utils.parseEther("0.01");
    await muonDVN.connect(owner).setFee(newFee);
    expect(await muonDVN.fee()).to.equal(newFee);
  });

  it("should not allow non-admin to set fee", async () => {
    const newFee = ethers.utils.parseEther("0.01");
    await expect(muonDVN.connect(addr1).setFee(newFee)).to.be.reverted;
  });

  // it("should assign a job successfully", async () => {
  //   const MESSAGE_LIB_ROLE = await muonDVN.MESSAGE_LIB_ROLE();
  //   await muonDVN.grantRole(MESSAGE_LIB_ROLE, owner.address);

  //   const assignJobParams = {
  //     dstEid: 1,
  //     packetHeader: ethers.utils.hexlify(ethers.utils.randomBytes(10)),
  //     payloadHash: ethers.utils.keccak256("0x1234"),
  //     confirmations: 2,
  //     sender: owner.address,
  //   };

  //   await muonDVN.updateSupportedDstChain(assignJobParams.dstEid, true);

  //   const options = "0x";

  //   const tx = await muonDVN
  //     .connect(owner)
  //     .assignJob(assignJobParams, options, {
  //       value: ethers.utils.parseEther("0.01"),
  //     });

  //   await expect(tx).to.emit(muonDVN, "JobAssigned");

  //   const job = await muonDVN.jobs(1);

  //   expect(job.dstEid).to.equal(assignJobParams.dstEid);
  //   expect(job.payloadHash).to.equal(assignJobParams.payloadHash);
  //   expect(job.sender).to.equal(assignJobParams.sender);
  // });
});
