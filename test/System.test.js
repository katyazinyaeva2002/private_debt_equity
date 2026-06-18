import { expect } from "chai";
import { ethers } from "ethers";
import fs from "fs";

// Глобальный сборщик данных о газе
const gasReport = [];

const collectGas = (name, receipt) => {
  gasReport.push({
    operation: name,
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status === 1 ? "Success" : "Failed"
  });
};

const printGasReport = () => {
  console.log("\n" + "=".repeat(90));
  console.log("📊 ОТЧЕТ ПО ЗАТРАТАМ ГАЗА");
  console.log("=".repeat(90));
  console.log("№ | Операция                              | Gas Used   | Статус  ");
  console.log("-".repeat(90));
  
  let totalGas = 0n;
  gasReport.forEach((entry, i) => {
    const gas = BigInt(entry.gasUsed);
    totalGas += gas;
    console.log(
      `${(i + 1).toString().padEnd(2)}| ${entry.operation.padEnd(37)} | ` +
      `${entry.gasUsed.padStart(10)} | ${entry.status.padEnd(7)}`
    );
  });
  
  console.log("-".repeat(90));
  console.log(`   ИТОГО использовано газа: ${totalGas.toString().padStart(10)} units`);
  console.log("=".repeat(90));
  
  // Сохраняем в файл для диплома
  fs.writeFileSync(
    "./gas-report.json",
    JSON.stringify(gasReport, null, 2)
  );
  console.log("\n💾 Отчет сохранен в gas-report.json\n");
};

describe("Private Equity Token System", function () {
  let provider;
  let owner, investor, compliance, badActor;
  let mockUSDC, registry, token, fund, div, red;

  const nonceManager = {
    owner: 0, investor: 0, compliance: 0, badActor: 0,
    async reset() {
      this.owner = await provider.getTransactionCount(owner.address);
      this.investor = await provider.getTransactionCount(investor.address);
      this.compliance = await provider.getTransactionCount(compliance.address);
      this.badActor = await provider.getTransactionCount(badActor.address);
    },
    next(who) { return this[who]++; }
  };

  const loadArtifact = async (name) => {
    const artifact = JSON.parse(
      fs.readFileSync(`./artifacts/contracts/${name}.sol/${name}.json`, "utf8")
    );
    return { abi: artifact.abi, bytecode: artifact.bytecode };
  };

  const deploy = async (signer, signerName, name, args = []) => {
    const { abi, bytecode } = await loadArtifact(name);
    const factory = new ethers.ContractFactory(abi, bytecode, signer);
    const contract = await factory.deploy(...args, { nonce: nonceManager.next(signerName) });
    const receipt = await contract.deploymentTransaction().wait();
    collectGas(`Deploy ${name}`, receipt);
    await contract.waitForDeployment();
    return contract;
  };

  const sendTx = async (signerName, name, txFn) => {
    const tx = await txFn({ nonce: nonceManager.next(signerName) });
    const receipt = await tx.wait();
    collectGas(name, receipt);
    return tx;
  };

  before(async function () {
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    owner = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
    investor = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider);
    compliance = new ethers.Wallet("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", provider);
    badActor = new ethers.Wallet("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", provider);
  });

  // Вывод отчета после всех тестов
  after(function () {
    printGasReport();
  });

  beforeEach(async function () {
    gasReport.length = 0; // Очищаем перед каждым тестом
    await nonceManager.reset();

    mockUSDC = await deploy(owner, "owner", "MockUSDC");
    registry = await deploy(owner, "owner", "IdentityRegistry");
    
    const COMPLIANCE_ROLE = await registry.COMPLIANCE_ROLE();
    await sendTx("owner", "Grant COMPLIANCE_ROLE", async (opts) => 
      registry.grantRole(COMPLIANCE_ROLE, compliance.address, opts)
    );
    
    token = await deploy(owner, "owner", "SecurityToken", ["PEQ", "PEQ", await registry.getAddress()]);

    fund = await deploy(owner, "owner", "FundraisingContract", [
      await token.getAddress(), await mockUSDC.getAddress(), await registry.getAddress(),
      ethers.parseUnits("1000000", 6), ethers.parseUnits("1", 6)
    ]);

    div = await deploy(owner, "owner", "DividendDistributor", [await token.getAddress(), await mockUSDC.getAddress()]);

    const maturityDate = Math.floor(Date.now() / 1000) + 3600;
    red = await deploy(owner, "owner", "RedemptionManager", [
      await token.getAddress(), await mockUSDC.getAddress(), maturityDate, ethers.parseUnits("1", 6)
    ]);

    const ISSUER = await token.ISSUER_ROLE();
    await sendTx("owner", "Grant ISSUER to Fundraising", async (opts) => 
      token.grantRole(ISSUER, await fund.getAddress(), opts)
    );
    await sendTx("owner", "Grant ISSUER to Redemption", async (opts) => 
      token.grantRole(ISSUER, await red.getAddress(), opts)
    );

    await sendTx("compliance", "KYC: setVerificationStatus", async (opts) =>
      registry.connect(compliance).setVerificationStatus(investor.address, true, 2, "RU", opts)
    );
    await sendTx("owner", "Mint 5000 USDC to investor", async (opts) =>
      mockUSDC.mint(investor.address, ethers.parseUnits("5000", 6), opts)
    );
    await sendTx("investor", "Approve USDC for Fundraising", async (opts) =>
      mockUSDC.connect(investor).approve(await fund.getAddress(), ethers.MaxUint256, opts)
    );
    await sendTx("investor", "Approve USDC for DividendDistributor", async (opts) =>
      mockUSDC.connect(investor).approve(await div.getAddress(), ethers.MaxUint256, opts)
    );
  });

  it("Инвестирование верифицированного адреса", async function () {
    await sendTx("investor", "contribute: инвестирование 1000 USDC", async (opts) =>
      fund.connect(investor).contribute(ethers.parseUnits("1000", 6), opts)
    );
    const balance = await token.balanceOf(investor.address);
    expect(balance).to.equal(ethers.parseUnits("1000", 0));
  });

  it("Блокировка неверифицированного адреса", async function () {
    await sendTx("owner", "Mint 1000 USDC to badActor", async (opts) =>
      mockUSDC.mint(badActor.address, ethers.parseUnits("1000", 6), opts)
    );
    await sendTx("badActor", "Approve USDC for badActor", async (opts) =>
      mockUSDC.connect(badActor).approve(await fund.getAddress(), ethers.parseUnits("1000", 6), opts)
    );

    try {
      await fund.connect(badActor).contribute(ethers.parseUnits("1000", 6), { nonce: nonceManager.next("badActor") });
      throw new Error("Should have reverted");
    } catch (e) {
      expect(e.message).to.include("Fundraising: Not verified");
    }
  });

  it("Pull-модель дивидендов", async function () {
    await sendTx("investor", "contribute: инвестирование 1000 USDC", async (opts) =>
      fund.connect(investor).contribute(ethers.parseUnits("1000", 6), opts)
    );

    await sendTx("owner", "Mint 100 USDC to owner", async (opts) =>
      mockUSDC.mint(owner.address, ethers.parseUnits("100", 6), opts)
    );
    await sendTx("owner", "Approve USDC for DividendDistributor", async (opts) =>
      mockUSDC.connect(owner).approve(await div.getAddress(), ethers.parseUnits("100", 6), opts)
    );
    await sendTx("owner", "distributeDividends: 100 USDC", async (opts) =>
      div.connect(owner).distributeDividends(ethers.parseUnits("100", 6), opts)
    );

    const pending = await div.getPendingDividends(investor.address);
    expect(pending).to.equal(ethers.parseUnits("100", 6));

    await sendTx("investor", "claim: получение дивидендов", async (opts) =>
      div.connect(investor).claim(opts)
    );

    const balance = await mockUSDC.balanceOf(investor.address);
    expect(balance).to.equal(ethers.parseUnits("4100", 6));
  });
});