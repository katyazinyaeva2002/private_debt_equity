import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const wallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log("Адрес:", wallet.address);
  console.log("Баланс:", ethers.formatEther(balance), "POL");
}

main().catch(console.error);