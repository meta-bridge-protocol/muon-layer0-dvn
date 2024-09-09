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
    "0x85615da8DD0188A89640aeb60D74551932D4Ab60",
    "0x6EDCE65403992e310A62460808c4b910D972f10f",
    "0x6098e96a28E02f27B1e6BD381f870F1C8Bd169d3",
    "0x3D1CBd70145b4025579DBFbBe643517C299bD423"
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
