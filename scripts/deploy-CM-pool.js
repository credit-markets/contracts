const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // You'll need to replace these with actual values
  const cmRegistryAddress = "0xE4b24A53719c50f2a0d686cE3504A877c3A6690E"; // Address of the CMRegistry contract
  const assetAddress = "0x0dec0488aeb6447a23b60fe416a5a133666bcd6e"; // Address of the ERC20 token used as the asset
  const name = "CM Pool Token";
  const symbol = "IPT";
  const poolParams = {
    startTime: Math.floor(Date.now() / 1000) + 3600, // Start in 1 hour
    endTime: Math.floor(Date.now() / 1000) + 172800, // End in 2 days
    threshold: hre.ethers.parseEther("100"), // 100 tokens
    amountToRaise: hre.ethers.parseEther("1000"), // 1000 tokens
    feeBasisPoints: 100, // 1%
    estimatedReturnBasisPoints: 1500, // 15%
    creditFacilitator: "0xAa93866E06c2Ec1fBDb5037D5495a3Aa6DB8F897",
    kycLevel: 0,
    term: 120 * 24 * 60 * 60, // 120 days in seconds
  };

  const CMPool = await hre.ethers.getContractFactory("CMPool");
  const cmPool = await CMPool.deploy(
    cmRegistryAddress,
    assetAddress,
    name,
    symbol,
    poolParams
  );

  await cmPool.waitForDeployment();

  const deployedAddress = await cmPool.getAddress();
  console.log("CMPool deployed to:", deployedAddress);

  // Wait for a few block confirmations to ensure the transaction is mined
  console.log("Waiting for a few confirmations...");
  await cmPool.deploymentTransaction().wait(5);

  // Verify the contract
  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address: deployedAddress,
      constructorArguments: [
        cmRegistryAddress,
        assetAddress,
        name,
        symbol,
        poolParams,
      ],
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
