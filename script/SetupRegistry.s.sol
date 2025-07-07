// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {CMRegistry} from "../contracts/CMRegistry.sol";
import {CMAccountFactory} from "../contracts/CMAccountFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract SetupRegistry is Script {
    bytes32 constant DEFAULT_ADMIN_ROLE =
        0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32 constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address signer = vm.addr(deployerPrivateKey);
        console.log("Starting Registry Setup...");
        console.log("Using signer:", signer);

        // Registry address from deployment
        address cmRegistryAddress = 0x7594B4D86BcC2745b42b6ea2bB039c1A4A7720Db;
        console.log("CMRegistry address:", cmRegistryAddress);

        // Check if contract exists
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(cmRegistryAddress)
        }
        require(codeSize > 0, "No contract found at the CMRegistry address");

        // Connect to the Registry contract
        CMRegistry registry = CMRegistry(cmRegistryAddress);
        console.log("Connected to Registry contract");

        // Check if signer has admin role
        bool hasAdminRole = registry.hasRole(DEFAULT_ADMIN_ROLE, signer);
        require(hasAdminRole, "Signer does not have admin role");
        console.log("Admin role verified");

        // 1. Add the factory
        address factoryAddress = 0xfC2933Bb085a076371F41A39121dfbf0d41F64b8;
        console.log("Adding factory:", factoryAddress);

        // Check if factory contract exists
        assembly {
            codeSize := extcodesize(factoryAddress)
        }

        if (codeSize > 0) {
            registry.addFactory(CMAccountFactory(payable(factoryAddress)));
            console.log("Successfully added factory");
        } else {
            console.log("No contract found at factory address");
        }

        // 2. Add tokens with price feeds
        address[] memory tokenAddresses = new address[](3);
        tokenAddresses[0] = 0x3bD31387587165655fE99a4c4E9b206477068e1b;
        tokenAddresses[1] = 0x0DEc0488AEB6447a23B60Fe416a5A133666bCd6E;
        tokenAddresses[2] = 0x458D487cFe39477a753Ad00B4B5Fad9a3483d54A;

        address[] memory priceFeedAddresses = new address[](3);
        priceFeedAddresses[0] = 0x80EDee6f667eCc9f63a0a6f55578F870651f06A4;
        priceFeedAddresses[1] = 0x0153002d20B96532C639313c2d54c3dA09109309;
        priceFeedAddresses[2] = 0xb113F5A928BCfF189C998ab20d753a47F9dE5A61;

        console.log("Adding tokens with price feeds...");
        
        // Convert addresses to contract interfaces
        IERC20[] memory tokens = new IERC20[](tokenAddresses.length);
        AggregatorV3Interface[] memory priceFeeds = new AggregatorV3Interface[](priceFeedAddresses.length);
        
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            tokens[i] = IERC20(tokenAddresses[i]);
            priceFeeds[i] = AggregatorV3Interface(priceFeedAddresses[i]);
        }
        
        registry.addToken(tokens, priceFeeds);
        console.log("Successfully added tokens with price feeds");

        // 3. Add attester role
        address attesterAddress = 0xC8d915D6410c373aF328d0E413d6BBC31Eb9d5Aa;

        bool hasAttesterRole = registry.hasRole(ATTESTER_ROLE, attesterAddress);

        if (hasAttesterRole) {
            console.log("Address already has ATTESTER_ROLE:", attesterAddress);
        } else {
            console.log("Granting ATTESTER_ROLE to:", attesterAddress);
            registry.grantAttesterRole(attesterAddress);
            console.log("Successfully granted ATTESTER_ROLE");
        }

        vm.stopBroadcast();

        // Log setup summary
        console.log("\n=== Registry Setup Summary ===");
        console.log("Registry Address:", cmRegistryAddress);
        console.log("Factory Added:", factoryAddress);
        console.log("Tokens Added: 3");
        console.log("Attester Address:", attesterAddress);
        console.log("Setup completed successfully");
        console.log("===============================");
    }
}
