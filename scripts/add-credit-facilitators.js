const hre = require("hardhat");

async function main() {
  console.log("Starting Credit Facilitator role assignment...");

  // Array of addresses to add as Credit Facilitators
  const facilitators = [
    "0xf37380c57881EeFcf503FBbf7670895A5b6c4421",
    "0x5A4830885f12438E00D8f4d98e9Fe083e707698C",
    "0xC8d915D6410c373aF328d0E413d6BBC31Eb9d5Aa",
  ];

  try {
    // Get the registry address from the CM-pool deployment script
    const cmRegistryAddress = "0x28E33846999C579665df68aE032BE3b7f48B7538";
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

    // Calculate CREDIT_FACILITATOR_ROLE hash
    const CREDIT_FACILITATOR_ROLE = hre.ethers.keccak256(
      hre.ethers.toUtf8Bytes("CREDIT_FACILITATOR_ROLE")
    );

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
        "Signer does not have admin role. Cannot grant facilitator roles."
      );
      return;
    }

    // Grant role to each facilitator
    for (const facilitator of facilitators) {
      try {
        const hasRole = await registry.hasRole(
          CREDIT_FACILITATOR_ROLE,
          facilitator
        );
        if (hasRole) {
          console.log(
            `Address ${facilitator} already has CREDIT_FACILITATOR_ROLE`
          );
          continue;
        }

        console.log(`Granting CREDIT_FACILITATOR_ROLE to ${facilitator}...`);
        const tx = await registry.grantRole(
          CREDIT_FACILITATOR_ROLE,
          facilitator
        );
        await tx.wait();
        console.log(`Successfully granted role to ${facilitator}`);
      } catch (error) {
        console.error(`Error granting role to ${facilitator}:`, error.message);
      }
    }

    console.log("Credit Facilitator role assignment completed");
  } catch (error) {
    console.error("Error:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
