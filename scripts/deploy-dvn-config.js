import hre, { ethers, run } from "hardhat";
import { Wallet, providers } from "ethers";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {

  const args = []

  const provider = new providers.JsonRpcProvider(hre.network.config.url)
  const signer = new Wallet(process.env.PRIVATE_KEY, provider);

  // const feeData = await ethers.provider.getFeeData();
  // const contract = await ethers.getContractFactory("MuonDVNConfig");
  // await contract.deploy({
  //   maxPriorityFeePerGas: feeData.maxPriorityFeePerGas, // tip the miner to execute the transaction
  //   maxFeePerGas: feeData.maxFeePerGas, // maxFeePerGas = baseFeePerGas + maxPriorityFeePerGas
  //   type: 2
  // });
  const contract = await ethers.deployContract("MuonDVNConfig", args, signer);

  await contract.deployed();

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
