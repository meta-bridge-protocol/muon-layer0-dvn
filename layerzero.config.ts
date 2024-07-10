import { EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const sepoliaContract: OmniPointHardhat = {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: 'ExampleOFT',
}

const bsctestContract: OmniPointHardhat = {
    eid: EndpointId.BSC_V2_TESTNET,
    contractName: 'ExampleOFT',
}

const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: sepoliaContract,
        },
        {
            contract: bsctestContract,
        },
    ],
    connections: [
        {
            from: sepoliaContract,
            to: bsctestContract,
            config: {
                // Required Send Library Address on Sepolia
                sendLibrary: "0xcc1ae8Cf5D3904Cef3360A9532B477529b177cCE",
                receiveLibraryConfig: {
                  // Required Receive Library Address on Sepolia
                  receiveLibrary: "0xdAf00F5eE2158dD58E0d3857851c432E34A3A851",
                  // Optional Grace Period for Switching Receive Library Address on Sepolia
                  gracePeriod: BigInt(0),
                },
                // Optional Send Configuration
                // @dev Controls how the `from` chain sends messages to the `to` chain.
                sendConfig: {
                  ulnConfig: {
                    // The number of block confirmations to wait on Sepolia before emitting the message from the source chain (Sepolia).
                    confirmations: BigInt(42),
                    // The address of the DVNs you will pay to verify a sent message on the source chain (Sepolia).
                    // The destination tx will wait until ALL `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0x5bC4E9c3Ba142611AA0EF98a66B3fd3E7e5ebe2a",
                        "0x8eebf8b423B73bFCa51a1Db4B7354AA0bFCA9193"
                    ],
                    // The address of the DVNs you will pay to verify a sent message on the source chain (Sepolia).
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
                // Optional Receive Configuration
                // @dev Controls how the `from` chain receives messages from the `to` chain.
                receiveConfig: {
                  ulnConfig: {
                    // The number of block confirmations to expect from the `to` chain (Sepolia).
                    confirmations: BigInt(42),
                    // The address of the DVNs your `receiveConfig` expects to receive verifications from on the `from` chain (Sepolia).
                    // The `from` chain's OApp will wait until the configured threshold of `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0x5bC4E9c3Ba142611AA0EF98a66B3fd3E7e5ebe2a",
                        "0x8eebf8b423B73bFCa51a1Db4B7354AA0bFCA9193"
                    ],
                    // The address of the `optionalDVNs` you expect to receive verifications from on the `from` chain (Sepolia).
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
            }
        },
        {
            from: bsctestContract,
            to: sepoliaContract,
            config: {
                sendLibrary: "0x55f16c442907e86D764AFdc2a07C2de3BdAc8BB7",
                receiveLibraryConfig: {
                  receiveLibrary: "0x188d4bbCeD671A7aA2b5055937F79510A32e9683",
                  gracePeriod: BigInt(0),
                },
                // Optional Send Configuration
                // @dev Controls how the `from` chain sends messages to the `to` chain.
                sendConfig: {
                  ulnConfig: {
                    confirmations: BigInt(42),
                    // The destination tx will wait until ALL `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0x9d95ebe060750440a0c335E59c1620C0d52256F5",
                        "0x0eE552262f7B562eFcED6DD4A7e2878AB897d405"
                    ],
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify a message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
                // Optional Receive Configuration
                // @dev Controls how the `from` chain receives messages from the `to` chain.
                receiveConfig: {
                  ulnConfig: {
                    confirmations: BigInt(42),
                    // The `from` chain's OApp will wait until the configured threshold of `requiredDVNs` verify the message.
                    requiredDVNs: [
                        "0x9d95ebe060750440a0c335E59c1620C0d52256F5",
                        "0x0eE552262f7B562eFcED6DD4A7e2878AB897d405"
                    ],
                    // The destination tx will wait until the configured threshold of `optionalDVNs` verify the message.
                    optionalDVNs: [
                    ],
                    // The number of `optionalDVNs` that need to successfully verify the message for it to be considered Verified.
                    optionalDVNThreshold: 0,
                  },
                },
            }
        },
    ],
}

export default config
