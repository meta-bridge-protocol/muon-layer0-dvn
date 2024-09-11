import hre, { ethers, run } from "hardhat";
import { Wallet, providers } from "ethers";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {

  const args = [
    "100910080158581338655846085823554014103388703502741867366803429671510325809150",
    {
      x: "0x25ee4bc28f38b61b1a0036dc08084300c0b8a423c4da17911a2ba4d9e845c2e5",
      parity: 1,
    },
    "0x31E32BAAAbE363dED6b67DAc424C7e87AD3c4979",
    "0x1a44076050125825900e736c501f859c50fE728c",
    "0x3c2269811836af69497E5F486A85D7316753cf62",
    "0xA6A30806dCdEE29eB5B8FC61C42bc104f44Cb325"
  ]

  const provider = new providers.JsonRpcProvider(hre.network.config.url)
  const signer = new Wallet(process.env.PRIVATE_KEY, provider);

  const contract = await ethers.deployContract("MuonDVN", args, signer);

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
