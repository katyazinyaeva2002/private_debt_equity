import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("🚀 Деплой в Polygon Amoy...\n");

  // Создаём provider и signer напрямую через ethers
  const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
  const wallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
  console.log("Адрес деплоера:", wallet.address);

  // Загружаем артефакты контрактов
  const loadArtifact = async (name) => {
    const artifact = JSON.parse(fs.readFileSync(`./artifacts/contracts/${name}.sol/${name}.json`, "utf8"));
    return { abi: artifact.abi, bytecode: artifact.bytecode };
  };

  const deploy = async (name, args = []) => {
    const { abi, bytecode } = await loadArtifact(name);
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`✅ ${name}:`, address);
    return { contract, address };
  };

  // 1. Mock USDC
  const mockUSDC = await deploy("MockUSDC");

  // 2. Identity Registry
  const identityRegistry = await deploy("IdentityRegistry");

  // 3. Security Token
  const securityToken = await deploy("SecurityToken", ["PEQ Token", "PEQ", identityRegistry.address]);

  // 4. Fundraising Contract
  const fundraising = await deploy("FundraisingContract", [
    securityToken.address, mockUSDC.address, identityRegistry.address,
    ethers.parseUnits("1000000", 6), ethers.parseUnits("1", 6)
  ]);

  // 5. Dividend Distributor
  const dividendDistributor = await deploy("DividendDistributor", [
    securityToken.address, mockUSDC.address
  ]);

  // 6. Redemption Manager (maturity = +30 дней (закомиченно). Для теста стоит на 1 час назад)
  const maturityDate = Math.floor(Date.now() / 1000) - 3600; // + (30 * 24 * 60 * 60);
  const redemptionManager = await deploy("RedemptionManager", [
    securityToken.address, mockUSDC.address, maturityDate, ethers.parseUnits("1", 6)
  ]);

  // 7. Настройка ролей
  console.log("\n⚙️ Настройка ролей...");
  const ISSUER_ROLE = await securityToken.contract.ISSUER_ROLE();
  await (await securityToken.contract.grantRole(ISSUER_ROLE, fundraising.address)).wait();
  await (await securityToken.contract.grantRole(ISSUER_ROLE, redemptionManager.address)).wait();
  console.log("✅ Роли ISSUER назначены");

  // 8. Минтим тестовые USDC
  await (await mockUSDC.contract.mint(wallet.address, ethers.parseUnits("50000", 6))).wait();
  console.log("🎉 Деплой завершено!");

  // Сохраняем адреса для тестов
  const addresses = {
    mockUSDC: mockUSDC.address,
    identityRegistry: identityRegistry.address,
    securityToken: securityToken.address,
    fundraising: fundraising.address,
    dividendDistributor: dividendDistributor.address,
    redemptionManager: redemptionManager.address
  };
  fs.writeFileSync("./deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("📁 Адреса сохранены в deployed-addresses.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });