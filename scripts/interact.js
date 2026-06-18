import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const rl = readline.createInterface({ 
  input: process.stdin, 
  output: process.stdout 
});
const ask = (q) => new Promise((res) => rl.question(q, res));

// Функция ожидания транзакции с таймаутом
const waitForTx = async (tx, timeoutMs = 120000) => {
  console.log("⏳ Ожидание подтверждения транзакции...");
  const receipt = await Promise.race([
    tx.wait(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Таймаут ожидания транзакции")), timeoutMs)
    )
  ]);
  return receipt;
};

async function main() {
  // Создаем provider с явным указанием сети
  const provider = new ethers.JsonRpcProvider(
    process.env.AMOY_RPC_URL,
    {
      name: "polygon-amoy",
      chainId: 80002
    }
  );
  
  const wallet = new ethers.Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
  console.log("👤 Подключены как:", wallet.address);
  
  // Проверяем баланс
  const balance = await provider.getBalance(wallet.address);
  console.log("💰 Баланс:", ethers.formatEther(balance), "POL\n");

  const addresses = JSON.parse(fs.readFileSync("./deployed-addresses.json", "utf8"));
  const loadAbi = (name) => JSON.parse(
    fs.readFileSync(`./artifacts/contracts/${name}.sol/${name}.json`, "utf8")
  ).abi;

  const mockUSDC = new ethers.Contract(addresses.mockUSDC, loadAbi("MockUSDC"), wallet);
  const registry = new ethers.Contract(addresses.identityRegistry, loadAbi("IdentityRegistry"), wallet);
  const token = new ethers.Contract(addresses.securityToken, loadAbi("SecurityToken"), wallet);
  const fund = new ethers.Contract(addresses.fundraising, loadAbi("FundraisingContract"), wallet);
  const div = new ethers.Contract(addresses.dividendDistributor, loadAbi("DividendDistributor"), wallet);
  const red = new ethers.Contract(addresses.redemptionManager, loadAbi("RedemptionManager"), wallet);

  console.log("\n📋 МЕНЮ ДЕМОНСТРАЦИИ СИСТЕМЫ ТОКЕНИЗАЦИИ\n");
  console.log("1. Пройти KYC (верификация инвестора)");
  console.log("2. Инвестировать 1000 USDC");
  console.log("3. Распределить дивиденды 50 USDC");
  console.log("4. Получить дивиденды (claim)");
  console.log("5. Активировать погашение (triggerCall)");
  console.log("6. Погасить 500 токенов (redeem)");
  console.log("7. 🚨 ДЕМО ДЕФОЛТА: попытка погасить без средств");
  console.log("8. Выход");

  const choice = await ask("\nВыберите действие (1-8): ");

  try {
    switch (choice) {
      case "1":
        console.log("\n🔐 Верификация инвестора...");
        const tx1 = await registry.setVerificationStatus(wallet.address, true, 2, "RU");
        await waitForTx(tx1);
        console.log("✅ Верифицирован! TX:", tx1.hash);
        console.log("🔗 https://amoy.polygonscan.com/tx/" + tx1.hash);
        break;

      case "2":
        console.log("\n💰 Инвестирование 1000 USDC...");
        // Проверяем, верифицирован ли адрес
        const isVerified = await registry.isVerified(wallet.address);
        if (!isVerified) {
          console.log("❌ Сначала пройдите KYC (пункт 1)!");
          break;
        }
        
        // Минтим USDC себе
        console.log("💵 Минтим 5000 USDC для тестов...");
        await waitForTx(await mockUSDC.mint(wallet.address, ethers.parseUnits("5000", 6)));
        
        // Approve
        console.log("🔑 Разрешаем списание USDC...");
        await waitForTx(await mockUSDC.approve(addresses.fundraising, ethers.parseUnits("1000", 6)));
        
        // Инвестируем
        console.log("💸 Инвестируем 1000 USDC...");
        const tx2 = await fund.contribute(ethers.parseUnits("1000", 6));
        await waitForTx(tx2);
        console.log("✅ Инвестировано! TX:", tx2.hash);
        console.log("🔗 https://amoy.polygonscan.com/tx/" + tx2.hash);
        console.log("💼 Баланс токенов PEQ:", ethers.formatUnits(await token.balanceOf(wallet.address), 0));
        break;

      case "3":
        console.log("\n💸 Распределение дивидендов 50 USDC...");
        // Проверяем, есть ли токены у инвесторов
        const totalSupply = await token.totalSupply();
        if (totalSupply === 0n) {
          console.log("❌ Сначала инвестируйте (пункт 2)! Нет держателей токенов.");
          break;
        }
        
        await waitForTx(await mockUSDC.approve(addresses.dividendDistributor, ethers.parseUnits("50", 6)));
        const tx3 = await div.distributeDividends(ethers.parseUnits("50", 6));
        await waitForTx(tx3);
        console.log("✅ Дивиденды распределены! TX:", tx3.hash);
        console.log("🔗 https://amoy.polygonscan.com/tx/" + tx3.hash);
        break;

      case "4":
        console.log("\n📥 Получение дивидендов (Pull-модель)...");
        const pending = await div.getPendingDividends(wallet.address);
        console.log("💰 К выплате:", ethers.formatUnits(pending, 6), "USDC");
        
        if (pending === 0n) {
          console.log("❌ Нет начисленных дивидендов. Сначала распределите их (пункт 3).");
          break;
        }
        
        const tx4 = await div.claim();
        await waitForTx(tx4);
        console.log("✅ Получено! TX:", tx4.hash);
        console.log("🔗 https://amoy.polygonscan.com/tx/" + tx4.hash);
        break;

      case "5":
        console.log("\n🔓 Активация погашения...");
        const tx5 = await red.triggerCall();
        await waitForTx(tx5);
        console.log("✅ Погашение активно! TX:", tx5.hash);
        console.log("🔗 https://amoy.polygonscan.com/tx/" + tx5.hash);
        break;

      case "6":
        console.log("\n🏦 Погашение 500 токенов...");
        const tokenBalance = await token.balanceOf(wallet.address);
        if (tokenBalance < ethers.parseUnits("500", 0)) {
          console.log("❌ Недостаточно токенов. Сначала инвестируйте (пункт 2).");
          break;
        }
        
        await waitForTx(await token.approve(addresses.redemptionManager, ethers.parseUnits("500", 0)));
        const tx6 = await red.redeem(ethers.parseUnits("500", 0));
        await waitForTx(tx6);
        console.log("✅ Погашено! TX:", tx6.hash);
        console.log("🔗 https://amoy.polygonscan.com/tx/" + tx6.hash);
        break;

      case "7":
        console.log("\n🚨 ДЕМО ДЕФОЛТА: попытка погасить ещё 500 токенов без средств...");
        const balance6 = await token.balanceOf(wallet.address);
        if (balance6 < ethers.parseUnits("500", 0)) {
          console.log("❌ Недостаточно токенов для демо дефолта.");
          break;
        }
        
        await waitForTx(await token.approve(addresses.redemptionManager, ethers.parseUnits("500", 0)));
        try {
          const tx7 = await red.redeem(ethers.parseUnits("500", 0));
          await waitForTx(tx7);
          console.log("⚠️ Неожиданно: транзакция прошла!");
        } catch (e) {
          console.log("\n❌ ОШИБКА (как и ожидалось):");
          console.log(e.shortMessage || e.message);
          console.log("\n📸 ЭТО И ЕСТЬ ОНЧЕЙН-ИНДИКАТОР ДЕФОЛТА!");
          console.log("Транзакция отклонена с ошибкой: Insufficient funds (DEFAULT)");
        }
        break;

      case "8":
        console.log("\n👋 До свидания!");
        break;

      default:
        console.log("❌ Неверный выбор");
    }
  } catch (e) {
    console.error("\n❌ Ошибка:", e.shortMessage || e.message);
  }

  rl.close();
}

main().catch(console.error);