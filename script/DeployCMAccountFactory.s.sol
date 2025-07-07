// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {CMAccountFactory} from "../contracts/CMAccountFactory.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";

contract DeployCMAccountFactory is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying contracts with the account:", deployer);

        // EntryPoint address - this is the standard EntryPoint v0.7.0 address
        address entryPointAddress = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

        // Deploy CMAccountFactory
        CMAccountFactory cmAccountFactory = new CMAccountFactory(
            deployer,
            IEntryPoint(entryPointAddress)
        );

        console.log("CMAccountFactory deployed to:", address(cmAccountFactory));

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== CMAccountFactory Deployment Summary ===");
        console.log("CMAccountFactory Address:", address(cmAccountFactory));
        console.log("Owner (Deployer):", deployer);
        console.log("EntryPoint Address:", entryPointAddress);
        console.log("============================================");
    }
}
