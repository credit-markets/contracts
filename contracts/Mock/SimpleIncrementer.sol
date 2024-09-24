// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleIncrementer {
    uint256 public number;

    function increment() public {
        number += 1;
    }

    function getNumber() public view returns (uint256) {
        return number;
    }
}
