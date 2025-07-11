// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

interface ICMRegistry {
    function feeReceiver() external view returns (address);

    function eas() external view returns (IEAS);

    // Add the OPERATOR_ROLE constant
    function OPERATOR_ROLE() external view returns (bytes32);

    // Add function to check if an account has a role
    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool);
}
