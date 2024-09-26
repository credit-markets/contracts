// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

interface IINARegistry {
    function feeReceiver() external view returns (address);

    function eas() external view returns (IEAS);
}
