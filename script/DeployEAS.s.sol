// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SchemaRegistry} from "@ethereum-attestation-service/eas-contracts/contracts/SchemaRegistry.sol";
import {EAS} from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";

contract DeployEAS is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying contracts with the account:", deployer);

        // Deploy SchemaRegistry
        SchemaRegistry schemaRegistry = new SchemaRegistry();
        console.log("SchemaRegistry deployed to:", address(schemaRegistry));

        // Deploy EAS
        EAS eas = new EAS(schemaRegistry);
        console.log("EAS deployed to:", address(eas));

        // Create a schema
        string
            memory schema = "uint256 kycId, uint256 kycLevel, address smartWallet";
        bool revocable = true;
        address resolver = address(0); // No resolver

        console.log("Creating schema...");
        bytes32 schemaId = schemaRegistry.register(schema, ISchemaResolver(resolver), revocable);
        console.log("Schema created with ID:");
        console.logBytes32(schemaId);

        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Deployment Summary ===");
        console.log("SchemaRegistry:", address(schemaRegistry));
        console.log("EAS:", address(eas));
        console.log("Schema ID:");
        console.logBytes32(schemaId);
        console.log("=========================");
    }
}
