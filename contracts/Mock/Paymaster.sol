// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {BasePaymaster} from "@account-abstraction/contracts/core/BasePaymaster.sol";

import {_packValidationData} from "@account-abstraction/contracts/core/Helpers.sol";
import {IEntryPoint, PackedUserOperation} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract Paymaster is BasePaymaster {
    constructor(address _entryPoint) BasePaymaster(IEntryPoint(_entryPoint)) {}

    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32,
        uint256
    )
        internal
        view
        virtual
        override
        returns (bytes memory context, uint256 validationData)
    {
        (userOp);

        (uint48 validAfter, uint48 validUntil) = abi.decode(
            userOp.paymasterAndData[PAYMASTER_DATA_OFFSET:],
            (uint48, uint48)
        );

        validationData = _packValidationData(false, validUntil, validAfter);
        context = "";
    }

    function _postOp(
        BasePaymaster.PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) internal override {
        // Custom logic for post-operation, like charging the user
    }
}
