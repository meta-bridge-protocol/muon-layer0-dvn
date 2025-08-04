const { ethers, Wallet, providers, BigNumber } = require("ethers");
const { EndpointId, EvmChain } = require("@layerzerolabs/lz-definitions");
const ABI = require("../artifacts/contracts/MuonDVNV2.sol/MuonDVNV2.json");
require("dotenv").config();

const DVNs = [
  {
    name: EvmChain.ARBITRUM,
    chainId: 42161,
    eids: [EndpointId.ARBITRUM_MAINNET, EndpointId.ARBITRUM_V2_MAINNET],
    rpc_url: "https://arb1.arbitrum.io/rpc",
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 200000,
      multiplierBps: 10500,
    },
  },
  {
    name: EvmChain.AVALANCHE,
    chainId: 43114,
    eids: [EndpointId.AVALANCHE_MAINNET, EndpointId.AVALANCHE_V2_MAINNET],
    rpc_url: `https://api.avax.network/ext/bc/C/rpc`,
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 100000,
      multiplierBps: 10000,
    },
  },
  {
    name: EvmChain.BASE,
    chainId: 8453,
    eids: [EndpointId.BASE_MAINNET, EndpointId.BASE_V2_MAINNET],
    rpc_url: "https://mainnet.base.org",
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 100000,
      multiplierBps: 10500,
    },
  },
  {
    name: EvmChain.BSC,
    chainId: 56,
    eids: [EndpointId.BSC_MAINNET, EndpointId.BSC_V2_MAINNET],
    rpc_url: "https://bsc-rpc.publicnode.com",
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 200000,
      multiplierBps: 10500,
    },
  },
  {
    name: EvmChain.FANTOM,
    chainId: 250,
    eids: [EndpointId.FANTOM_MAINNET, EndpointId.FANTOM_V2_MAINNET],
    rpc_url: `https://rpcapi.fantom.network`,
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 100000,
      multiplierBps: 10500,
    },
  },
  {
    name: EvmChain.ZKCONSENSYS,
    chainId: 59144,
    eids: [EndpointId.ZKCONSENSYS_MAINNET, EndpointId.ZKCONSENSYS_V2_MAINNET],
    rpc_url: `https://rpc.linea.build`,
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 100000,
      multiplierBps: 10500,
    },
  },
  {
    name: EvmChain.OPTIMISM,
    chainId: 10,
    eids: [EndpointId.OPTIMISM_MAINNET, EndpointId.OPTIMISM_V2_MAINNET],
    rpc_url: `https://mainnet.optimism.io`,
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 100000,
      multiplierBps: 10500,
    },
  },
  {
    name: EvmChain.POLYGON,
    chainId: 137,
    eids: [EndpointId.POLYGON_MAINNET, EndpointId.POLYGON_V2_MAINNET],
    rpc_url: `https://polygon-bor-rpc.publicnode.com`,
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 100000,
      multiplierBps: 10500,
    },
  },
  {
    name: "sonic",
    chainId: 146,
    eids: [332, 30332],
    rpc_url: "https://rpc.soniclabs.com",
    address: "0xA3858e2A9860C935Fc9586a617e9b2A674C3e4c8",
    feeConfig: {
      gas: 100000,
      multiplierBps: 10500,
    },
  },
];

async function main() {
  for (let i = 0; i < DVNs.length; i++) {
    try {
      const dvn = DVNs[i];

      const provider = new providers.JsonRpcProvider(dvn.rpc_url);
      const signer = new Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
      const contract = new ethers.Contract(dvn.address, ABI.abi, signer);

      for (let j = 0; j < DVNs.length; j++) {
        if (i != j) {
          const peerDVN = DVNs[j];
          for (let z = 0; z < peerDVN.eids.length; z++) {
            try {
              const eid = peerDVN.eids[z];
              let isSupported = await contract.supportedDstChain(eid);
              if (!isSupported) {
                console.log(
                  `Setup pathway from chain ${dvn.name} to chain ${peerDVN.name} eid ${eid}`
                );
                // const feeData = await provider.getFeeData();
                let tx;
                if (dvn.chainId == 137) {
                  tx = await contract.updateSupportedDstChain(eid, true, {
                    maxPriorityFeePerGas: ethers.utils.parseUnits("30", "gwei"), // tip
                    maxFeePerGas: ethers.utils.parseUnits("100", "gwei"), // tip + base fee
                  });
                } else {
                  tx = await contract.updateSupportedDstChain(eid, true);
                }
                await tx.wait();
              } else {
                console.log(
                  `Pathway from chain ${dvn.name} to chain ${peerDVN.name} is already configured`
                );
              }
            } catch (error) {
              console.log(error.toString());
            }
            try {
              const eid = peerDVN.eids[z];
              const { feeConfig } = peerDVN;
              let { gas } = await contract.dstConfig(eid);
              if (gas.toString() == 0) {
                console.log(
                  `Setup dst config for chain ${peerDVN.name} eid ${eid}`
                );
                // const feeData = await provider.getFeeData();
                let tx;
                if (dvn.chainId == 137) {
                  tx = await contract.setDstConfig(
                    [[eid, feeConfig.gas, feeConfig.multiplierBps, 0n]],
                    {
                      maxPriorityFeePerGas: ethers.utils.parseUnits(
                        "30",
                        "gwei"
                      ), // tip
                      maxFeePerGas: ethers.utils.parseUnits("100", "gwei"), // tip + base fee
                    }
                  );
                } else {
                  tx = await contract.setDstConfig([[
                    eid,
                    feeConfig.gas,
                    feeConfig.multiplierBps,
                    0n,
                  ]]);
                }
                await tx.wait();
              } else {
                console.log(
                  `Dst config for chain ${peerDVN.name} is already configured`
                );
              }
            } catch (error) {
              console.log(error);
              console.log(error.toString());
            }
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}

// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
