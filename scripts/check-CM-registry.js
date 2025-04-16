const hre = require("hardhat");

async function main() {
  console.log("Starting CMRegistry check...");
  try {
    // Get the registry address from the CM-pool deployment script
    const cmRegistryAddress = "0x28E33846999C579665df68aE032BE3b7f48B7538";
    console.log("CMRegistry address:", cmRegistryAddress);

    // Check if the contract exists at that address
    console.log("Checking if contract exists at address...");
    const code = await hre.ethers.provider.getCode(cmRegistryAddress);
    console.log(`Code length at address: ${code.length}`);

    if (code === "0x") {
      console.log(
        "No contract found at the CMRegistry address:",
        cmRegistryAddress
      );
      return;
    }

    console.log("Contract found at CMRegistry address:", cmRegistryAddress);

    // Try to instantiate the contract
    console.log("Attempting to instantiate the Registry contract...");
    try {
      const Registry = await hre.ethers.getContractFactory("Registry");
      console.log("Got Registry contract factory");
      const registry = await Registry.attach(cmRegistryAddress);
      console.log("Attached to Registry contract at", cmRegistryAddress);

      // Call some view functions to verify it's our contract
      console.log("Checking Registry contract functions...");
      try {
        const eas = await registry.eas();
        console.log("Registry EAS address:", eas);
      } catch (error) {
        console.log("Error calling eas() function:", error.message);
      }

      // Try to get the fee receiver
      try {
        const feeReceiver = await registry.feeReceiver();
        console.log("Fee receiver:", feeReceiver);
      } catch (error) {
        console.log("Error calling feeReceiver() function:", error.message);
      }

      // Try to use a hard-coded value for CREDIT_FACILITATOR_ROLE
      try {
        // Calculate CREDIT_FACILITATOR_ROLE hash directly
        const CREDIT_FACILITATOR_ROLE = hre.ethers.keccak256(
          hre.ethers.toUtf8Bytes("CREDIT_FACILITATOR_ROLE")
        );
        console.log(
          "Calculated CREDIT_FACILITATOR_ROLE:",
          CREDIT_FACILITATOR_ROLE
        );

        // Check if the facilitator in our deploy script has this role
        const facilitator = "0x5A4830885f12438E00D8f4d98e9Fe083e707698C";
        const hasRole = await registry.hasRole(
          CREDIT_FACILITATOR_ROLE,
          facilitator
        );
        console.log(
          `Does ${facilitator} have CREDIT_FACILITATOR_ROLE:`,
          hasRole
        );
      } catch (error) {
        console.log(
          "Error checking CREDIT_FACILITATOR_ROLE with calculated hash:",
          error.message
        );
      }
    } catch (error) {
      console.log("Error attaching to Registry contract:", error.message);
    }
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
