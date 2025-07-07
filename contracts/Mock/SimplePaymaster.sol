// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {BasePaymaster} from "@account-abstraction/contracts/core/BasePaymaster.sol";
import {IEntryPoint, PackedUserOperation} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract SimplePaymaster is BasePaymaster {
    constructor(address _entryPoint) BasePaymaster(IEntryPoint(_entryPoint)) {}

    function _validatePaymasterUserOp(
        PackedUserOperation calldata,
        bytes32,
        uint256
    ) internal pure override returns (bytes memory context, uint256 preOpGas) {
        // Custom logic to validate the UserOperation
        // This example simply approves all operations
        context = new bytes(0);
        preOpGas = 0;
    }

    function _postOp(
        BasePaymaster.PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        // Custom logic for post-operation, like charging the user
    }

    // Add funding function to support the paymaster
    function addFunds() external payable {
        require(msg.value > 0, "No funds provided");
    }
}
