import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";
import path from "path";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, read } = hre.deployments;
  const network = hre.network.name;
  const confirmations = network === "sepolia" ? 2 : 1;

  console.log(`\nDeploying CipherBook system to ${network}...`);
  console.log(`Deployer: ${deployer}\n`);

  // ── 1. BaseToken ───────────────────────────────────────────────────────────
  console.log("1/4  Deploying BaseToken (TKN)...");
  const baseToken = await deploy("MockERC20", {
    contract: "MockERC20",
    from: deployer,
    args: ["CipherBook Token", "TKN", 18],
    log: true,
    waitConfirmations: confirmations,
  });
  console.log(`     BaseToken deployed to: ${baseToken.address}\n`);

  // ── 2. QuoteToken ──────────────────────────────────────────────────────────
  console.log("2/4  Deploying QuoteToken (QUSD)...");
  const quoteToken = await deploy("MockERC20_Quote", {
    contract: "MockERC20",
    from: deployer,
    args: ["CipherBook USD", "QUSD", 6],
    log: true,
    waitConfirmations: confirmations,
  });
  console.log(`     QuoteToken deployed to: ${quoteToken.address}\n`);

  // ── 3. CipherBookFactory ───────────────────────────────────────────────────
  console.log("3/4  Deploying CipherBookFactory...");
  const factory = await deploy("CipherBookFactory", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: confirmations,
  });
  console.log(`     Factory deployed to: ${factory.address}\n`);

  // ── 4. Create TKN/QUSD pair via factory ────────────────────────────────────
  console.log("4/4  Creating TKN/QUSD pair through factory...");
  await execute(
    "CipherBookFactory",
    { from: deployer, log: true, waitConfirmations: confirmations },
    "createPair",
    baseToken.address,
    quoteToken.address,
  );

  const cipherBookAddress = await read(
    "CipherBookFactory",
    "getPair",
    baseToken.address,
    quoteToken.address,
  ) as string;
  console.log(`     CipherBook (TKN/QUSD) deployed to: ${cipherBookAddress}\n`);

  // ── Export addresses ───────────────────────────────────────────────────────
  const outDir = path.join(__dirname, "../deployments-export");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const exportData = {
    network,
    deployedAt: new Date().toISOString(),
    deployer,
    CipherBookFactory: factory.address,
    CipherBook: cipherBookAddress,
    BaseToken: baseToken.address,
    QuoteToken: quoteToken.address,
  };

  const exportPath = path.join(outDir, `${network}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

  console.log("─".repeat(60));
  console.log(`Factory     : ${factory.address}`);
  console.log(`CipherBook  : ${cipherBookAddress}`);
  console.log(`BaseToken   : ${baseToken.address}`);
  console.log(`QuoteToken  : ${quoteToken.address}`);
  console.log(`\nDeployment info saved to: deployments-export/${network}.json`);
};

export default func;
func.id = "deploy_cipherbook";
func.tags = ["CipherBook"];
