// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {CMRegistry} from "../contracts/CMRegistry.sol";

contract DeployRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying Registry contract with the account:", deployer);

        // Contract addresses from your previous deployment
        address easAddress = 0x883E13e20b3c9EC645124c41602C4d816b2a2891;
        bytes32 kycSchemaUid = 0xf5bd2195e0f1ba7f62373334a223109769b179cb717363089926ffbd9637630d;
        address feeReceiverAddress = 0x26b0D6F8F405EaCBd5632A5B0290E7Ca286456De;

        // Deploy Registry contract
        CMRegistry registry = new CMRegistry(
            easAddress,
            kycSchemaUid,
            feeReceiverAddress
        );

        console.log("Registry deployed to:", address(registry));

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== Registry Deployment Summary ===");
        console.log("Registry Address:", address(registry));
        console.log("EAS Address:", easAddress);
        console.log("KYC Schema UID:");
        console.logBytes32(kycSchemaUid);
        console.log("Fee Receiver:", feeReceiverAddress);
        console.log("=====================================");
    }
}
