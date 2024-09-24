const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // You'll need to replace this with the actual EntryPoint address for your network
  const entryPointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  const InaAccountFactory = await hre.ethers.getContractFactory(
    "InaAccountFactory"
  );
  const inaAccountFactory = await InaAccountFactory.deploy(
    deployer.address,
    entryPointAddress
  );

  await inaAccountFactory.waitForDeployment();

  const deployedAddress = await inaAccountFactory.getAddress();
  console.log("InaAccountFactory deployed to:", deployedAddress);

  // Wait for a few block confirmations to ensure the transaction is mined
  console.log("Waiting for a few confirmations...");
  await inaAccountFactory.deploymentTransaction().wait(5);

  // Verify the contract
  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: deployedAddress,
      constructorArguments: [deployer.address, entryPointAddress],
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
