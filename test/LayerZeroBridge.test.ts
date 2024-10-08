import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  deployMockContract,
  MockContract,
} from "@ethereum-waffle/mock-contract";
import LZ_ENDPOINT_ABI from "./abi/LayerZeroEndpoint.json";
import GATEWAY_ABI from "./abi/GatewayV2.json";
import { LayerZeroBridge, MBToken, TestToken } from "../typechain-types";

describe("LayerZeroBridge", () => {
  let bridge: LayerZeroBridge;
  let lzEndpoint: MockContract;
  let gateway: MockContract;
  let bridgeToken: MBToken;
  let nativeToken: TestToken;
  let treasury: SignerWithAddress;
  let admin: SignerWithAddress,
    tokenAdder: SignerWithAddress,
    user: SignerWithAddress;

  before(async () => {
    [admin, tokenAdder, user, treasury] = await ethers.getSigners();
  });

  beforeEach(async () => {
    lzEndpoint = await deployMockContract(admin, LZ_ENDPOINT_ABI);
    gateway = await deployMockContract(admin, GATEWAY_ABI);

    const BridgeFactory = await ethers.getContractFactory("LayerZeroBridge");
    bridge = await BridgeFactory.connect(admin).deploy(lzEndpoint.address);

    await bridge
      .connect(admin)
      .grantRole(await bridge.TOKEN_ADDER_ROLE(), tokenAdder.address);

    const BridgeTokenFactory = await ethers.getContractFactory("MBToken");
    const TestTokenFactory = await ethers.getContractFactory("TestToken");

    await lzEndpoint.mock.setDelegate.returns();

    bridgeToken = await BridgeTokenFactory.deploy(
      "Bridge Token",
      "bToken",
      lzEndpoint.address,
      admin.address
    );
    await bridgeToken.deployed();

    nativeToken = await TestTokenFactory.deploy("Native Token", "rToken");
    await nativeToken.deployed();

    await nativeToken.mint(user.address, 1000);
  });

  describe("Token operations", () => {
    it("should add token successfully", async () => {
      expect(
        await bridge
          .connect(tokenAdder)
          .addToken(
            nativeToken.address,
            bridgeToken.address,
            treasury.address,
            gateway.address,
            true,
            false
          )
      ).not.to.be.reverted;
      expect((await bridge.tokens(nativeToken.address)).mbToken).to.deep.eq(
        bridgeToken.address
      );
    });
  });
});
