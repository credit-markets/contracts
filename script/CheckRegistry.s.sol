// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {CMRegistry} from "../contracts/CMRegistry.sol";

contract CheckRegistry is Script {
    bytes32 constant CREDIT_FACILITATOR_ROLE =
        keccak256("CREDIT_FACILITATOR_ROLE");

    function run() external view {
        console.log("Starting CMRegistry check...");

        // Registry address to check
        address cmRegistryAddress = 0x28E33846999C579665df68aE032BE3b7f48B7538;
        console.log("CMRegistry address:", cmRegistryAddress);

        // Check if contract exists at that address
        console.log("Checking if contract exists at address...");
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(cmRegistryAddress)
        }
        console.log("Code size at address:", codeSize);

        if (codeSize == 0) {
            console.log("No contract found at the CMRegistry address");
            return;
        }

        console.log("Contract found at CMRegistry address");

        // Try to instantiate the contract
        console.log("Attempting to instantiate the CMRegistry contract...");

        CMRegistry registry = CMRegistry(cmRegistryAddress);
        console.log("Successfully connected to CMRegistry contract");

        // Call view functions to verify it's our contract
        console.log("Checking CMRegistry contract functions...");

        // Check EAS address
        address easAddress = address(registry.EAS());
        console.log("Registry EAS address:", easAddress);

        // Check fee receiver
        address feeReceiver = registry.feeReceiver();
        console.log("Fee receiver:", feeReceiver);

        // Check CREDIT_FACILITATOR_ROLE
        console.log("Calculated CREDIT_FACILITATOR_ROLE:");
        console.logBytes32(CREDIT_FACILITATOR_ROLE);

        // Check if the facilitator has the role
        address facilitator = 0x5A4830885f12438E00D8f4d98e9Fe083e707698C;
        bool hasRole = registry.hasRole(CREDIT_FACILITATOR_ROLE, facilitator);
        console.log("Facilitator address:", facilitator);
        console.log("Has CREDIT_FACILITATOR_ROLE:", hasRole);

        // Additional checks - check if we have admin role
        // bytes32 DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;
        // address admin = registry.getRoleMember(DEFAULT_ADMIN_ROLE, 0);
        // console.log("Admin (first member):", admin);

        // Check schema UID if available
        bytes32 schemaUid = registry.kycSchemaUid();
        console.log("KYC Schema UID:");
        console.logBytes32(schemaUid);

        console.log("\n=== Registry Check Summary ===");
        console.log("Registry Address:", cmRegistryAddress);
        console.log("Contract Exists:", codeSize > 0);
        console.log("CREDIT_FACILITATOR_ROLE:");
        console.logBytes32(CREDIT_FACILITATOR_ROLE);
        console.log("==============================");
    }
}
