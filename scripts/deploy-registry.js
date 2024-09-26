const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log(
    "Deploying Registry contract with the account:",
    deployer.address
  );

  // Replace these with your actual values
  const easAddress = "0xF403D1cE0197373FE1F42b6fcdd8F66b61410700";
  const kycSchemaUID =
    "0xf5bd2195e0f1ba7f62373334a223109769b179cb717363089926ffbd9637630d";
  const feeReceiverAddress = "0xAa93866E06c2Ec1fBDb5037D5495a3Aa6DB8F897";

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
