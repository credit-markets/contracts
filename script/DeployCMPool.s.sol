// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {CMPool} from "../contracts/CMPool.sol";
import {ICMRegistry} from "../contracts/interfaces/ICMRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployCMPool is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying contracts with the account:", deployer);

        // Contract addresses - replace with your actual values
        address cmRegistryAddress = 0x7594B4D86BcC2745b42b6ea2bB039c1A4A7720Db;
        address assetAddress = 0x0DEc0488AEB6447a23B60Fe416a5A133666bCd6E;

        // Pool token details
        string memory name = "CM Pool Token";
        string memory symbol = "CMPT";

        // Pool parameters
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

        // Deploy CMPool
        CMPool cmPool = new CMPool(
            ICMRegistry(cmRegistryAddress),
            IERC20(assetAddress),
            name,
            symbol,
            poolParams
        );

        console.log("CMPool deployed to:", address(cmPool));

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== CMPool Deployment Summary ===");
        console.log("CMPool Address:", address(cmPool));
        console.log("CM Registry:", cmRegistryAddress);
        console.log("Asset Address:", assetAddress);
        console.log("Pool Name:", name);
        console.log("Pool Symbol:", symbol);
        console.log("Start Time:", poolParams.startTime);
        console.log("End Time:", poolParams.endTime);
        console.log("Threshold:", poolParams.threshold);
        console.log("Amount to Raise:", poolParams.amountToRaise);
        console.log("Fee (bps):", poolParams.feeBasisPoints);
        console.log(
            "Est. Return (bps):",
            poolParams.estimatedReturnBasisPoints
        );
        console.log("Credit Facilitator:", poolParams.creditFacilitator);
        console.log("KYC Level:", poolParams.kycLevel);
        console.log("Term (seconds):", poolParams.term);
        console.log("==================================");
    }
}
