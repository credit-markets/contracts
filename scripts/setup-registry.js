const hre = require("hardhat");

async function main() {
  console.log("Starting Registry Setup...");

  try {
    // Get the registry address from the CM-pool deployment
    const cmRegistryAddress = "0x7594B4D86BcC2745b42b6ea2bB039c1A4A7720Db";
    console.log("CMRegistry address:", cmRegistryAddress);

    // Check if the contract exists at that address
    const code = await hre.ethers.provider.getCode(cmRegistryAddress);
    if (code === "0x") {
      console.log(
        "No contract found at the CMRegistry address:",
        cmRegistryAddress
      );
      return;
    }

    // Instantiate the contract
    const Registry = await hre.ethers.getContractFactory("Registry");
    const registry = await Registry.attach(cmRegistryAddress);
    console.log("Connected to Registry contract at", cmRegistryAddress);

    // Get the signer (account that will execute the transactions)
    const [signer] = await hre.ethers.getSigners();
    console.log("Using signer:", signer.address);

    // Check if signer has admin role
    const DEFAULT_ADMIN_ROLE =
      "0x0000000000000000000000000000000000000000000000000000000000000000";
    const hasAdminRole = await registry.hasRole(
      DEFAULT_ADMIN_ROLE,
      signer.address
    );
    if (!hasAdminRole) {
      console.error(
        "Signer does not have admin role. Cannot perform setup operations."
      );
      return;
    }

    // 1. Add the factory
    const factoryAddress = "0xfC2933Bb085a076371F41A39121dfbf0d41F64b8";
    console.log(`Adding factory ${factoryAddress}...`);

    // First check if the contract exists at the factory address
    const factoryCode = await hre.ethers.provider.getCode(factoryAddress);
    if (factoryCode === "0x") {
      console.log("No contract found at the factory address:", factoryAddress);
    } else {
      const tx1 = await registry.addFactory(factoryAddress);
      await tx1.wait();
      console.log(`Successfully added factory ${factoryAddress}`);
    }

    // 2. Add the tokens
    // We'll need to provide price feed addresses for each token
    // For this example, using dummy price feed addresses (replace with actual ones)
    const tokenAddresses = [
      "0x3bD31387587165655fE99a4c4E9b206477068e1b",
      "0x0DEc0488AEB6447a23B60Fe416a5A133666bCd6E",
      "0x458D487cFe39477a753Ad00B4B5Fad9a3483d54A",
    ];

    const priceFeedAddresses = [
      "0x80EDee6f667eCc9f63a0a6f55578F870651f06A4",
      "0x0153002d20B96532C639313c2d54c3dA09109309",
      "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61",
    ];

    console.log("Adding tokens with price feeds...");
    const tx2 = await registry.addToken(tokenAddresses, priceFeedAddresses);
    await tx2.wait();
    console.log("Successfully added tokens with price feeds");

    // 3. Add attester role
    const attesterAddress = "0xC8d915D6410c373aF328d0E413d6BBC31Eb9d5Aa";
    const ATTESTER_ROLE = hre.ethers.keccak256(
      hre.ethers.toUtf8Bytes("ATTESTER_ROLE")
    );

    const hasAttesterRole = await registry.hasRole(
      ATTESTER_ROLE,
      attesterAddress
    );

    if (hasAttesterRole) {
      console.log(`Address ${attesterAddress} already has ATTESTER_ROLE`);
    } else {
      console.log(`Granting ATTESTER_ROLE to ${attesterAddress}...`);
      const tx3 = await registry.grantAttesterRole(attesterAddress);
      await tx3.wait();
      console.log(`Successfully granted ATTESTER_ROLE to ${attesterAddress}`);
    }

    console.log("Registry setup completed successfully");
  } catch (error) {
    console.error("Error during registry setup:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
