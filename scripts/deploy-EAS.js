const hre = require("hardhat");
const { ethers } = require("hardhat");

async function verifyContract(address, constructorArguments) {
  console.log(`Verifying contract at ${address}`);
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments,
    });
    console.log("Contract verified successfully");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy SchemaRegistry
  const SchemaRegistry = await ethers.getContractFactory("SchemaRegistry");
  const schemaRegistry = await SchemaRegistry.deploy();
  await schemaRegistry.waitForDeployment();
  const schemaRegistryAddress = await schemaRegistry.getAddress();
  console.log("SchemaRegistry deployed to:", schemaRegistryAddress);

  // Deploy EAS
  const EAS = await ethers.getContractFactory("EAS");
  const eas = await EAS.deploy(schemaRegistryAddress);
  await eas.waitForDeployment();
  const easAddress = await eas.getAddress();
  console.log("EAS deployed to:", easAddress);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await ethers.provider.waitForTransaction(eas.deploymentTransaction().hash, 5);

  // Verify SchemaRegistry
  await verifyContract(schemaRegistryAddress, []);

  // Verify EAS
  await verifyContract(easAddress, [schemaRegistryAddress]);

  // Create a schema
  const schema = "uint256 kycId, uint256 kycLevel, address smartWallet";
  const revocable = true;
  const resolver = ethers.ZeroAddress; // No resolver for this example

  const tx = await schemaRegistry.register(schema, resolver, revocable);
  const receipt = await tx.wait();

  // Get the schema ID from the event
  const event = receipt.logs.find((log) => log.fragment.name === "Registered");
  const schemaId = event.args.uid;

  console.log("Schema created with ID:", schemaId);

  return schemaId;
}

main()
  .then((schemaId) => {
    console.log("Returned Schema ID:", schemaId);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
