// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SchemaRegistry} from "@ethereum-attestation-service/eas-contracts/contracts/SchemaRegistry.sol";
import {EAS} from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import {CMRegistry} from "../contracts/CMRegistry.sol";
import {ICMRegistry} from "../contracts/interfaces/ICMRegistry.sol";
import {CMAccountFactory} from "../contracts/CMAccountFactory.sol";
import {CMPool} from "../contracts/CMPool.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract DeployAll is Script {
    // Constants
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    bytes32 constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    // Configuration addresses - UPDATE THESE WITH YOUR ACTUAL VALUES
    address constant FEE_RECEIVER = 0x26b0D6F8F405EaCBd5632A5B0290E7Ca286456De;
    address constant ATTESTER_ADDRESS =
        0xC8d915D6410c373aF328d0E413d6BBC31Eb9d5Aa;

    // Token and price feed addresses for setup
    address[] tokenAddresses = [
        0x3bD31387587165655fE99a4c4E9b206477068e1b,
        0x0DEc0488AEB6447a23B60Fe416a5A133666bCd6E,
        0x458D487cFe39477a753Ad00B4B5Fad9a3483d54A
    ];

    address[] priceFeedAddresses = [
        0x80EDee6f667eCc9f63a0a6f55578F870651f06A4,
        0x0153002d20B96532C639313c2d54c3dA09109309,
        0xb113F5A928BCfF189C998ab20d753a47F9dE5A61
    ];

    // Deployed contract addresses (will be populated during deployment)
    SchemaRegistry schemaRegistry;
    EAS eas;
    bytes32 schemaId;
    CMRegistry cmRegistry;
    CMAccountFactory cmAccountFactory;
    CMPool cmPool;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("=== STARTING COMPLETE DEPLOYMENT ===");
        console.log("Deployer:", deployer);
        console.log("=====================================\n");

        // Step 1: Deploy EAS Infrastructure
        _deployEAS();

        // Step 2: Deploy CMRegistry
        _deployCMRegistry();

        // Step 3: Deploy CMAccountFactory
        _deployCMAccountFactory();

        // Step 5: Deploy CMPool
        _deployCMPool();

        // Step 6: Setup Registry
        _setupRegistry();

        vm.stopBroadcast();

        // Final Summary
        _printFinalSummary();
    }

    function _deployEAS() internal {
        console.log("1. DEPLOYING EAS INFRASTRUCTURE");
        console.log("================================");

        // Deploy SchemaRegistry
        schemaRegistry = new SchemaRegistry();
        console.log("SchemaRegistry deployed to:", address(schemaRegistry));

        // Deploy EAS
        eas = new EAS(schemaRegistry);
        console.log("EAS deployed to:", address(eas));

        // Create KYC schema
        string
            memory schema = "uint256 kycId, uint256 kycLevel, address smartWallet";
        bool revocable = true;
        address resolver = address(0);

        console.log("Creating KYC schema...");
        schemaId = schemaRegistry.register(
            schema,
            ISchemaResolver(resolver),
            revocable
        );
        console.log("Schema created with ID:");
        console.logBytes32(schemaId);
        console.log("");
    }

    function _deployCMRegistry() internal {
        console.log("2. DEPLOYING CM REGISTRY");
        console.log("========================");

        cmRegistry = new CMRegistry(address(eas), schemaId, FEE_RECEIVER);

        console.log("CMRegistry deployed to:", address(cmRegistry));
        console.log("EAS Address:", address(eas));
        console.log("Schema ID:");
        console.logBytes32(schemaId);
        console.log("Fee Receiver:", FEE_RECEIVER);
        console.log("");
    }

    function _deployCMAccountFactory() internal {
        console.log("3. DEPLOYING CM ACCOUNT FACTORY");
        console.log("===============================");

        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        cmAccountFactory = new CMAccountFactory(
            deployer,
            IEntryPoint(ENTRY_POINT)
        );

        console.log("CMAccountFactory deployed to:", address(cmAccountFactory));
        console.log("Owner:", deployer);
        console.log("EntryPoint:", ENTRY_POINT);
        console.log("");
    }

    function _deployCMPool() internal {
        console.log("5. DEPLOYING CM POOL");
        console.log("====================");

        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        // Pool configuration
        string memory name = "CM Pool Token";
        string memory symbol = "CMPT";
        uint256 currentTime = block.timestamp;

        CMPool.PoolParams memory poolParams = CMPool.PoolParams({
            startTime: currentTime + 3600, // Start in 1 hour
            endTime: currentTime + 2629743, // End in ~30 days
            threshold: 100 ether, // 100 tokens
            amountToRaise: 1000 ether, // 1000 tokens
            feeBasisPoints: 100, // 1%
            estimatedReturnBasisPoints: 1500, // 15%
            creditFacilitator: deployer,
            kycLevel: 0,
            term: 120 * 24 * 60 * 60 // 120 days in seconds
        });

        cmPool = new CMPool(
            ICMRegistry(address(cmRegistry)),
            IERC20(tokenAddresses[1]), // Using second token as asset
            name,
            symbol,
            poolParams
        );

        console.log("CMPool deployed to:", address(cmPool));
        console.log("Asset Token:", tokenAddresses[1]);
        console.log("Credit Facilitator:", deployer);
        console.log("");
    }

    function _setupRegistry() internal {
        console.log("6. SETTING UP REGISTRY");
        console.log("======================");

        // Add the CMAccountFactory
        console.log("Adding CMAccountFactory to registry...");
        cmRegistry.addFactory(cmAccountFactory);
        console.log("Factory added successfully");

        // Add tokens and price feeds
        console.log("Adding tokens and price feeds...");
        IERC20[] memory tokens = new IERC20[](tokenAddresses.length);
        AggregatorV3Interface[] memory priceFeeds = new AggregatorV3Interface[](
            priceFeedAddresses.length
        );

        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            tokens[i] = IERC20(tokenAddresses[i]);
            priceFeeds[i] = AggregatorV3Interface(priceFeedAddresses[i]);
        }

        cmRegistry.addToken(tokens, priceFeeds);
        console.log("Added", tokenAddresses.length, "tokens with price feeds");

        // Grant attester role
        console.log("Granting ATTESTER_ROLE to:", ATTESTER_ADDRESS);
        cmRegistry.grantAttesterRole(ATTESTER_ADDRESS);
        console.log("ATTESTER_ROLE granted successfully");
        console.log("");
    }

    function _printFinalSummary() internal view {
        console.log("========================================");
        console.log("          DEPLOYMENT COMPLETE          ");
        console.log("========================================");
        console.log("");
        console.log("CORE CONTRACTS:");
        console.log("---------------");
        console.log("SchemaRegistry:    ", address(schemaRegistry));
        console.log("EAS:              ", address(eas));
        console.log("CMRegistry:       ", address(cmRegistry));
        console.log("CMAccountFactory: ", address(cmAccountFactory));
        console.log("CMPool:           ", address(cmPool));
        console.log("");
        console.log("CONFIGURATION:");
        console.log("--------------");
        console.log("Schema ID:");
        console.logBytes32(schemaId);
        console.log("EntryPoint:       ", ENTRY_POINT);
        console.log("Fee Receiver:     ", FEE_RECEIVER);
        console.log("Attester:         ", ATTESTER_ADDRESS);
        console.log("");
        console.log("TOKENS ADDED:     ", tokenAddresses.length);
        console.log("========================================");
        console.log("");
        console.log("========================================");
    }
}
