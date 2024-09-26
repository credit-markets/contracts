const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(
    "Deploying Registry contract with the account:",
    deployer.address
  );

  // Replace these with your actual values
  const easAddress = "0x1234567890123456789012345678901234567890";
  const kycSchemaUID =
    "0x1234567890123456789012345678901234567890123456789012345678901234";
  const feeReceiverAddress = "0x9876543210987654321098765432109876543210";

  const Registry = await hre.ethers.getContractFactory("Registry");
  const registry = await Registry.deploy(
    easAddress,
    kycSchemaUID,
    feeReceiverAddress
  );

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
      constructorArguments: [easAddress, kycSchemaUID, feeReceiverAddress],
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
