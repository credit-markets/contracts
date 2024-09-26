const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(
    "Deploying UpgradeableRegistry contract with the account:",
    deployer.address
  );

  // Deploy the implementation contract
  const UpgradeableRegistry = await hre.ethers.getContractFactory(
    "UpgradeableRegistry"
  );
  const implementationContract = await UpgradeableRegistry.deploy();
  await implementationContract.waitForDeployment();

  const implementationAddress = await implementationContract.getAddress();
  console.log(
    "UpgradeableRegistry implementation deployed to:",
    implementationAddress
  );

  // Deploy the proxy contract
  const { deployProxy } = require("@openzeppelin/hardhat-upgrades");

  // Replace these with your actual values
  const easAddress = "0x1234567890123456789012345678901234567890";
  const kycSchemaUID =
    "0x1234567890123456789012345678901234567890123456789012345678901234";
  const feeReceiverAddress = "0x9876543210987654321098765432109876543210";

  const proxy = await deployProxy(
    UpgradeableRegistry,
    [easAddress, kycSchemaUID, feeReceiverAddress],
    {
      initializer: "initialize",
    }
  );
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  console.log("UpgradeableRegistry proxy deployed to:", proxyAddress);

  // Wait for a few block confirmations to ensure the transaction is mined
  console.log("Waiting for confirmations...");
  await proxy.deploymentTransaction().wait(5);

  // Verify the implementation contract
  console.log("Verifying implementation contract...");
  try {
    await hre.run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    console.log("Implementation contract verified successfully");
  } catch (error) {
    console.error("Error verifying implementation contract:", error);
  }

  // Note: Proxy contracts typically can't be verified in the same way as regular contracts
  console.log(
    "Note: Proxy contract verification may need to be done manually through the block explorer"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
