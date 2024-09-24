const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(
    "Deploying Registry contract with the account:",
    deployer.address
  );

  const Registry = await hre.ethers.getContractFactory("Registry");
  const registry = await Registry.deploy();

  await registry.waitForDeployment();

  const deployedAddress = await registry.getAddress();
  console.log("Registry deployed to:", deployedAddress);

  // Wait for a few block confirmations to ensure the transaction is mined
  console.log("Waiting for confirmations...");
  await registry.deploymentTransaction().wait(5);

  // Verify the contract
  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: deployedAddress,
      constructorArguments: [],
    });
    console.log("Contract verified successfully");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
