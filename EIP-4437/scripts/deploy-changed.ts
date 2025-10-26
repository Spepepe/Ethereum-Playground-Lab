import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// デプロイ済みコントラクトの情報を保存するファイル
const DEPLOYMENT_FILE = path.join(__dirname, "..", "deployments.json");

interface DeploymentInfo {
  [contractName: string]: {
    address: string;
    txHash: string;
    deployer: string;
    timestamp: string;
    network: string;
    chainId: string;
  };
}

/**
 * デプロイ情報を読み込み
 */
function loadDeployments(): DeploymentInfo {
  if (fs.existsSync(DEPLOYMENT_FILE)) {
    return JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf-8"));
  }
  return {};
}

/**
 * デプロイ情報を保存
 */
function saveDeployments(deployments: DeploymentInfo) {
  fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(deployments, null, 2));
}

/**
 * コントラクトをデプロイ（変更があった場合のみ）
 */
async function deployIfChanged(
  contractName: string,
  args: any[],
  deployer: any,
  network: any
): Promise<string | null> {
  console.log(`\n--- Checking ${contractName} ---`);

  const deployments = loadDeployments();
  const networkKey = `${network.name}-${network.chainId}`;
  const existingDeployment = deployments[`${contractName}-${networkKey}`];

  // 新規デプロイの場合
  if (!existingDeployment) {
    console.log(`${contractName}: New deployment required`);
    const Contract = await ethers.getContractFactory(contractName);
    const contract = await Contract.deploy(...args);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    const deployTx = contract.deploymentTransaction();

    console.log(`${contractName} deployed to:`, address);
    console.log(`Transaction hash:`, deployTx?.hash);

    // デプロイ情報を保存
    deployments[`${contractName}-${networkKey}`] = {
      address,
      txHash: deployTx?.hash || "",
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      network: network.name,
      chainId: network.chainId.toString(),
    };
    saveDeployments(deployments);

    return address;
  }

  // 既にデプロイ済み
  console.log(`${contractName}: Already deployed at ${existingDeployment.address}`);
  console.log(`Deployed on: ${existingDeployment.timestamp}`);
  console.log(`Skipping re-deployment (gas savings)`);

  return existingDeployment.address;
}

async function main() {
  console.log("Starting smart deployment (changed contracts only)...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address))
  );

  // EntryPoint v0.7 address (same as v0.6 on most networks)
  const ENTRYPOINT_ADDRESS =
    process.env.ENTRYPOINT_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  console.log("Using EntryPoint at:", ENTRYPOINT_ADDRESS);

  // SimpleAccountFactory をデプロイ（変更があれば）
  const factoryAddress = await deployIfChanged(
    "SimpleAccountFactory",
    [ENTRYPOINT_ADDRESS],
    deployer,
    network
  );

  // VerifyingPaymaster をデプロイ（変更があれば）
  const PAYMASTER_SIGNER = process.env.PAYMASTER_SIGNER || deployer.address;
  const paymasterAddress = await deployIfChanged(
    "VerifyingPaymaster",
    [ENTRYPOINT_ADDRESS, PAYMASTER_SIGNER],
    deployer,
    network
  );

  console.log("\n--- Deployment Summary ---");
  console.log("SimpleAccountFactory:", factoryAddress || "Not deployed (no changes)");
  console.log("VerifyingPaymaster:", paymasterAddress || "Not deployed (no changes)");
  console.log("EntryPoint:", ENTRYPOINT_ADDRESS);

  console.log("\n--- Gas Savings ---");
  console.log(
    "Skipped re-deployment of unchanged contracts, saving gas fees!"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
