import 'dotenv/config'
import "@nomicfoundation/hardhat-toolbox";
import 'hardhat-deploy'
import '@openzeppelin/hardhat-upgrades';
import '@layerzerolabs/toolbox-hardhat';
import { HttpNetworkUserConfig } from "hardhat/types";
import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types';
import { EndpointId } from '@layerzerolabs/lz-definitions';

const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts: HttpNetworkAccountsUserConfig | undefined = PRIVATE_KEY ? [PRIVATE_KEY] : undefined

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const networks: { [networkName: string]: HttpNetworkUserConfig } = {
  sepolia: {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    url: "https://rpc.ankr.com/eth_sepolia",
    chainId: 11155111,
    accounts
  },
  bscTestnet: {
    eid: EndpointId.BSC_V2_TESTNET,
    url: "https://bsc-testnet.publicnode.com",
    chainId: 97,
    accounts
  }
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    ...networks
  },
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY || "",
      sepolia: process.env.ETHERSCAN_KEY || "",
      goerli: process.env.ETHERSCAN_KEY || "",
      bscTestnet: process.env.BSCSCAN_KEY || "",
      bsc: process.env.BSCSCAN_KEY || "",
      polygon: process.env.POLYGON_KEY || "",
      polygonMumbai: process.env.POLYGON_KEY || "",
      lineaMainnet: process.env.LINEASCAN_KEY || "",
      optimisticEthereum: process.env.OPTIMISM_KEY || "",
      avalancheFujiTestnet: process.env.AVALANCHE_KEY || ""
    },
    customChains: [
      {
        network: "ftm",
        chainId: 250,
        urls: {
          apiURL: "https://ftmscan.com/",
          browserURL: "https://ftmscan.com/",
        },
      },
      {
        network: "lineaMainnet",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build/",
        },
      }
    ]
  },
  namedAccounts: {
      deployer: {
          default: 0, // wallet address of index[0], of the mnemonic in .env
      },
  },
};

export default config;
