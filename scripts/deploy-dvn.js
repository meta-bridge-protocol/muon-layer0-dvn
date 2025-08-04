import hre, { ethers, run } from "hardhat";
import { Wallet, providers } from "ethers";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {

  const args = [
    "27992038535770428799229208263523559271450762784194064804079095287200791610667",
    {
      x: "0x0a111a7914e7e6bce1a2ccc259377a409ffae9e24dd6d429c1512517c45b0c58",
      parity: 1,
    },
    "0x83c18d45422229234F760D11E91D35A21c80EaAa", // muon contract
    "0x6EDCE65403992e310A62460808c4b910D972f10f", // endpoint v2
    "0x6098e96a28E02f27B1e6BD381f870F1C8Bd169d3", // endpoint v1
    "0xDc69075d15F75607e29CFbCF92D1073F908E2a4C", // dvn config
    12200, // defaultMultiplierBps
    2, // quorum
    "0x0000000000000000000000000000000000000000", // priceFeed
    "0x0000000000000000000000000000000000000000" // feeLib
  ]

  const provider = new providers.JsonRpcProvider(hre.network.config.url)
  const signer = new Wallet(process.env.PRIVATE_KEY, provider);

  const contract = await ethers.deployContract("MuonDVNV2", args, signer);

  // const contractFactory = await ethers.getContractFactory("MuonDVNV2");
  // const contract = await contractFactory.deploy(...args, {
  //   gasLimit: 30_000_000,
  //   type: 2
  // });

  // await contract.deployed();

  console.log(
    `contract deployed to ${contract.address}`
  );
  
  await sleep(20000);

  await run("verify:verify", {
    address: contract.address,
    constructorArguments: args,
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
