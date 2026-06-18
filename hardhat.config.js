import "@nomicfoundation/hardhat-gas-reporter";
import dotenv from "dotenv";
dotenv.config();

/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: { chainId: 31337 },
    amoy: {
      url: process.env.AMOY_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 80002
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 30,
    showTimeSpent: true,
    outputFile: "gas-report.txt",
    noColors: false
  }
};